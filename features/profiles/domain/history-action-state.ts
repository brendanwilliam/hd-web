export type HistoryActionState = {
  status: "idle" | "updated" | "cooldown" | "error";
  message: string;
};

export const initialHistoryActionState: HistoryActionState = {
  status: "idle",
  message: "",
};
