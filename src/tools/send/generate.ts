export type SendMode = "message" | "title" | "subtitle" | "actionbar";
export type SendTarget = "player" | "all players" | "console";

export type SendBuilder = {
  mode: SendMode;
  target: SendTarget;
  content: string;
  subtitle: string;
  fadeIn: number;
  stay: number;
  fadeOut: number;
};

export const defaultSendBuilder: SendBuilder = {
  mode: "message",
  target: "player",
  content: "&a안녕하세요",
  subtitle: "&7어서오세요",
  fadeIn: 10,
  stay: 70,
  fadeOut: 20
};

export function generateSendLines(builder: SendBuilder): string[] {
  const target = builder.target;
  const content = builder.content;

  switch (builder.mode) {
    case "actionbar":
      return [`send action bar "${content}" to ${target}`];
    case "subtitle":
      return [`send subtitle "${content}" to ${target}`];
    case "title":
      return [
        `send title "${content}" with subtitle "${builder.subtitle}" to ${target} for ${builder.fadeIn} ticks, ${builder.stay} ticks and ${builder.fadeOut} ticks`
      ];
    case "message":
    default:
      return [`send "${content}" to ${target}`];
  }
}
