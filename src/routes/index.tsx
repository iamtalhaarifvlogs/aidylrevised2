import { createFileRoute } from "@tanstack/react-router";
import { CommandCenter } from "@/components/command-center";

export const Route = createFileRoute("/")({ component: CommandCenter });
