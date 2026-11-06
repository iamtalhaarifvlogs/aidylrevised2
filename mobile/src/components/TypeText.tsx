import { useEffect, useState } from "react";
import { Text } from "react-native";
import { colors } from "../theme";

function plan(text: string) {
  const step = text.length > 420 ? 4 : text.length > 220 ? 3 : text.length > 110 ? 2 : 1;
  return { step, interval: 22 };
}

export function TypeText({ text, play }: { text: string; play: boolean }) {
  const [count, setCount] = useState(play ? 0 : text.length);

  useEffect(() => {
    if (!play) {
      setCount(text.length);
      return;
    }
    const { step, interval } = plan(text);
    let i = 0;
    const id = setInterval(() => {
      i = Math.min(text.length, i + step);
      setCount(i);
      if (i >= text.length) clearInterval(id);
    }, interval);
    return () => clearInterval(id);
  }, [play, text]);

  const done = count >= text.length;
  return (
    <Text>
      {text.slice(0, count)}
      {done ? null : <Text style={{ color: colors.brass }}> ▍</Text>}
    </Text>
  );
}
