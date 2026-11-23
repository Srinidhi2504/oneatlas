// /rankings has no content of its own: send visitors to the default board.
import { redirect } from "next/navigation";

export default function RankingsIndex() {
  redirect("/rankings/reach");
}
