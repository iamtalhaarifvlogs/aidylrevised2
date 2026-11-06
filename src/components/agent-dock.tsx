import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpen, Send } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { respond, type Persona } from "@/lib/agents/engine";
import { crmBySlug, saveTraining } from "@/lib/crm/data";
import { useAidyl, type ChatMessage } from "@/lib/store";
import { cn, nowIso, uid } from "@/lib/utils";

const EMPTY_THREAD: ChatMessage[] = [];

function personaFor(
  path: string,
  choice: "desk" | "chief",
  specialists: { id: string; name: string; crmSlug: string; brief: string; createdAt: string }[],
): Persona {
  const match = path.match(/^\/crm\/([^/]+)/);
  const slug = match?.[1];
  const mine = specialists.filter((s) => s.crmSlug === slug);
  if (!slug || choice === "chief") {
    return { id: "randolph", name: "Randolph", kind: "randolph", scope: "*" };
  }
  if (slug === "carshipy" || slug === "ogamoto") {
    return { id: "maya", name: "Maya", kind: "maya", scope: "carshipy" };
  }
  const spec = mine[0];
  if (spec) {
    return {
      id: `specialist:${spec.id}`,
      name: spec.name,
      kind: "specialist",
      scope: spec.crmSlug,
      brief: spec.brief,
      specialist: spec,
    };
  }
  return { id: "randolph", name: "Randolph", kind: "randolph", scope: "*" };
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function typePlan(text: string, reduced: boolean) {
  if (reduced || text.length === 0) return { step: Math.max(text.length, 1), interval: 0, total: 0 };
  const step = text.length > 420 ? 4 : text.length > 220 ? 3 : text.length > 110 ? 2 : 1;
  const ticks = Math.ceil(text.length / step);
  const interval = 22;
  return { step, interval, total: ticks * interval + 40 };
}

export function AgentDock() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<"desk" | "chief">("desk");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [teach, setTeach] = useState(false);
  const [lesson, setLesson] = useState("");
  const [teachNote, setTeachNote] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const liveIds = useRef(new Set<string>());
  const finishedIds = useRef(new Set<string>());
  const specialists = useAidyl((s) => s.specialists);
  const persona = personaFor(path, choice, specialists);
  const thread = useAidyl((s) => s.threads[persona.id]) ?? EMPTY_THREAD;
  const pushMessage = useAidyl((s) => s.pushMessage);
  const setMind = useAidyl((s) => s.setMind);
  const clearThread = useAidyl((s) => s.clearThread);
  const operator = useAidyl((s) => s.operatorName);

  useEffect(() => {
    setChoice("desk");
  }, [path]);

  useEffect(() => {
    if (!open) {
      for (const id of liveIds.current) finishedIds.current.add(id);
    }
  }, [open]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [thread, open, thinking, teach]);

  function scrollThread() {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }

  function pushLive(message: ChatMessage) {
    liveIds.current.add(message.id);
    pushMessage(persona.id, message);
  }



  const crmMatch = path.match(/^\/crm\/([^/]+)/);
  const crm = crmMatch?.[1] ?? "*";
  const crmName = crm === "*" ? "Aidyl" : crmBySlug(crm)?.name ?? "Aidyl";
  const prompts =
    persona.kind === "maya"
      ? ["What needs my attention?", "How is the Carshipy pipeline?", "Prepare a campaign for Nigeria buyers: never pay before the vehicle and the lane are named", "Remind me in 1 hour to call the hot lead"]
      : ["What changed while I was away?", "Prepare a campaign for people shipping cars to Nigeria. Tell them not to pay before the vehicle and the lane are named.", "What are the risks?", "Ask Maya about deposits"];

  async function teachNow(e: FormEvent) {
    e.preventDefault();
    const body = lesson.trim();
    if (body.length < 8) {
      setTeachNote("Write a full sentence so they can actually use it.");
      return;
    }
    const agent = persona.kind === "maya" ? "maya" : "randolph";
    await saveTraining({ agent, title: body.split(/[.!?]/)[0].slice(0, 80), body });
    setLesson("");
    setTeachNote(`${persona.name} has it. Ask about it in a moment.`);
    pushLive({
      id: uid("msg"),
      role: "agent",
      agent: persona.name,
      text: `Got it. I'll keep that, and I'll use it the next time it fits.`,
      at: nowIso(),
    });
  }

  async function send(raw?: string) {
    const value = (raw ?? text).trim();
    if (!value || busy) return;
    setText("");
    setTeach(false);
    const userMsg: ChatMessage = { id: uid("msg"), role: "user", text: value, at: nowIso() };
    pushMessage(persona.id, userMsg);
    setBusy(true);
    setThinking(true);
    try {
      const state = useAidyl.getState();
      const turn = await respond({
        persona,
        text: value,
        crm: persona.scope === "*" ? crm : persona.scope,
        mind: state.minds[persona.id] ?? {},
        operator: state.operatorName || "Admin",
        training: state.training,
      });
      setMind(persona.id, turn.mind);
      const reduced = prefersReducedMotion();
      const words = turn.text.split(/\s+/).filter(Boolean).length;
      await wait(reduced ? 40 : Math.min(1200, 650 + Math.min(words, 30) * 14));
      setThinking(false);
      pushLive({
        id: uid("msg"),
        role: "agent",
        agent: persona.name,
        text: turn.text,
        at: nowIso(),
      });
      await wait(typePlan(turn.text, reduced).total);
      if (turn.aether) {
        await wait(reduced ? 20 : 280);
        pushLive({ id: uid("msg"), role: "aether", agent: "Aether", text: turn.aether, at: nowIso() });
        await wait(typePlan(turn.aether, reduced).total);
      }
      if (turn.peer) {
        await wait(reduced ? 20 : 360);
        pushLive({
          id: uid("msg"),
          role: "peer",
          agent: turn.peer.name,
          text: turn.peer.text,
          at: nowIso(),
        });
        await wait(typePlan(turn.peer.text, reduced).total);
      }
    } catch (error) {
      setThinking(false);
      pushLive({
        id: uid("msg"),
        role: "agent",
        agent: persona.name,
        text: error instanceof Error ? error.message : "I hit a problem reading the desk.",
        at: nowIso(),
      });
    } finally {
      setBusy(false);
      setThinking(false);
    }
  }

  const deskLabel = persona.kind === "maya" ? "Carshipy" : persona.kind === "specialist" ? crmName : "Command";

  return (
    <div className="fixed right-3 bottom-3 z-40 flex flex-col items-end gap-3 sm:right-5 sm:bottom-5">
      {open ? (
        <section className="aidyl-rise flex h-dock max-h-[70vh] w-80 flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-2xl sm:w-96">
          <header className="bg-ink px-4 py-4 text-paper">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-full bg-brass font-display text-lg">{persona.name.slice(0, 1)}</span>
                <div>
                  <p className="font-display text-2xl leading-none">{persona.name}</p>
                  <p className="mt-1 text-xs text-paper/70">
                    {deskLabel}
                    {operator ? ` · with ${operator}` : ""} · Aether writes
                  </p>
                </div>
              </div>
              <button className="text-sm text-paper/70" onClick={() => clearThread(persona.id)}>
                Clear
              </button>
            </div>
          </header>
          <div className="flex items-center gap-2 border-b border-line px-3 py-2">
            {crm !== "*" ? (
              <>
                <button
                  className={cn("rounded-full px-3 py-2 text-xs", choice === "desk" ? "bg-ink text-paper" : "bg-bg text-ink")}
                  onClick={() => setChoice("desk")}
                >
                  This desk
                </button>
                <button
                  className={cn("rounded-full px-3 py-2 text-xs", choice === "chief" ? "bg-ink text-paper" : "bg-bg text-ink")}
                  onClick={() => setChoice("chief")}
                >
                  Randolph
                </button>
              </>
            ) : (
              <p className="px-1 text-xs text-muted">Talk like a colleague. The book is there when you want it.</p>
            )}
            <button
              className={cn(
                "ml-auto inline-flex items-center gap-1 rounded-full px-3 py-2 text-xs",
                teach ? "bg-brass text-paper" : "bg-brass-soft text-brass",
              )}
              onClick={() => {
                setTeach((v) => !v);
                setTeachNote("");
              }}
            >
              <BookOpen className="size-3.5" />
              Train
            </button>
          </div>
          {teach ? (
            <form onSubmit={teachNow} className="space-y-2 border-b border-line bg-brass-soft px-3 py-3">
              <p className="text-xs text-ink">
                Teach {persona.name} in a sentence. It is saved to their book and used the next time it fits.
              </p>
              <textarea
                value={lesson}
                onChange={(e) => setLesson(e.target.value)}
                rows={3}
                placeholder="Deposits are requested only after the vehicle and the lane are named."
                className="w-full resize-none rounded-xl border border-line bg-surface px-3 py-2 text-sm"
              />
              <div className="flex items-center justify-between gap-2">
                {crm === "*" ? (
                  <Link to="/training" className="text-xs text-brass underline" onClick={() => setOpen(false)}>
                    Open the full studio
                  </Link>
                ) : (
                  <Link
                    to="/crm/$slug/$section"
                    params={{ slug: crm, section: "training" }}
                    className="text-xs text-brass underline"
                    onClick={() => setOpen(false)}
                  >
                    Open the full studio
                  </Link>
                )}
                <button className="rounded-full bg-ink px-3 py-2 text-xs text-paper">Save lesson</button>
              </div>
              {teachNote ? <p className="text-xs text-forest">{teachNote}</p> : null}
            </form>
          ) : null}
          <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto bg-bg px-3 py-3">
            {thread.length === 0 ? (
              <div className="space-y-3">
                <p className="rounded-2xl bg-paper px-3 py-3 text-sm">
                  {persona.kind === "maya"
                    ? `Hey${operator && operator !== "Admin" ? ` ${operator}` : ""}. I'm Maya. Tell me about a buyer, or describe a campaign and I'll file the proposal. I won't contact anyone from here.`
                    : `Hello${operator && operator !== "Admin" ? ` ${operator}` : ""}. I'm ${persona.name}. We can walk the companies, or you can describe a campaign and I'll file it for your approval.`}
                </p>
                <div className="flex flex-wrap gap-2">
                  {prompts.map((prompt) => (
                    <button
                      key={prompt}
                      className="rounded-full border border-line bg-surface px-3 py-2 text-left text-xs"
                      onClick={() => void send(prompt)}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {thread.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                play={liveIds.current.has(msg.id) && !finishedIds.current.has(msg.id)}
                onFrame={scrollThread}
                onDone={() => finishedIds.current.add(msg.id)}
              />
            ))}
            {thinking ? <Typing name={persona.name} /> : null}
          </div>
          <form
            className="border-t border-line bg-surface p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <div className="flex items-end gap-2">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                rows={2}
                placeholder={`Message ${persona.name}`}
                className="min-h-12 flex-1 resize-none rounded-2xl border border-line bg-bg px-3 py-2 text-sm"
              />
              <button
                disabled={busy || !text.trim()}
                aria-label="Send"
                className="grid size-11 shrink-0 place-items-center rounded-full bg-brass text-paper disabled:opacity-50"
              >
                <Send className="size-4" />
              </button>
            </div>
          </form>
        </section>
      ) : null}
      <button
        aria-expanded={open}
        aria-label={open ? "Close agent chat" : `Open chat with ${persona.name}`}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full bg-ink py-1.5 pr-4 pl-1.5 text-paper shadow-xl"
      >
        <span className="grid size-11 place-items-center rounded-full bg-brass font-display text-lg">{persona.name.slice(0, 1)}</span>
        <span className="text-left">
          <span className="block text-sm leading-none">{open ? "Close" : persona.name}</span>
          <span className="mt-1 block text-xs text-paper/60">{open ? "Hide the thread" : "Talk or train"}</span>
        </span>
      </button>
    </div>
  );
}

function Typing({ name }: { name: string }) {
  return (
    <div className="mr-8 flex items-center gap-2 rounded-2xl bg-paper px-3 py-3" aria-live="polite">
      <span className="text-xs text-muted">{name} is writing</span>
      <span className="flex gap-1" aria-hidden>
        <span className="typing-dot size-1.5 rounded-full bg-brass" />
        <span className="typing-dot size-1.5 rounded-full bg-brass" />
        <span className="typing-dot size-1.5 rounded-full bg-brass" />
      </span>
    </div>
  );
}

function MessageBubble({
  message,
  play,
  onFrame,
  onDone,
}: {
  message: ChatMessage;
  play: boolean;
  onFrame: () => void;
  onDone: () => void;
}) {
  if (message.role === "user") {
    return <p className="ml-10 rounded-2xl rounded-br-md bg-brass px-3 py-2 text-sm whitespace-pre-wrap text-paper">{message.text}</p>;
  }
  if (message.role === "aether") {
    return (
      <p className="rounded-2xl bg-forest-soft px-3 py-2 text-xs whitespace-pre-wrap text-forest">
        <span className="text-forest">Aether · </span>
        <TypedText text={message.text} play={play} onFrame={onFrame} onDone={onDone} />
      </p>
    );
  }
  return (
    <div className={cn("mr-6 rounded-2xl rounded-bl-md px-3 py-2 text-sm whitespace-pre-wrap", message.role === "peer" ? "border border-line bg-surface" : "bg-paper")}>
      <p className="mb-1 text-xs text-brass">{message.agent}</p>
      <TypedText text={message.text} play={play} onFrame={onFrame} onDone={onDone} />
    </div>
  );
}

function TypedText({
  text,
  play,
  onFrame,
  onDone,
}: {
  text: string;
  play: boolean;
  onFrame: () => void;
  onDone: () => void;
}) {
  const frame = useRef(onFrame);
  const done = useRef(onDone);
  frame.current = onFrame;
  done.current = onDone;
  const [count, setCount] = useState(() => (play ? 0 : text.length));

  useEffect(() => {
    if (!play) {
      setCount(text.length);
      return;
    }
    const reduced = prefersReducedMotion();
    const plan = typePlan(text, reduced);
    if (reduced || plan.total === 0) {
      setCount(text.length);
      done.current();
      return;
    }
    let i = 0;
    const id = window.setInterval(() => {
      i = Math.min(text.length, i + plan.step);
      setCount(i);
      frame.current();
      if (i >= text.length) {
        window.clearInterval(id);
        done.current();
      }
    }, plan.interval);
    return () => window.clearInterval(id);
  }, [play, text]);

  const complete = count >= text.length;
  return (
    <span aria-label={text}>
      <span aria-hidden>
        {text.slice(0, count)}
        {complete ? null : <span className="typing-caret ml-0.5 inline-block h-4 w-0.5 bg-brass align-text-bottom" />}
      </span>
    </span>
  );
}
