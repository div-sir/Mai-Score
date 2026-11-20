import type { Metadata } from "next";
import SongResearchCenter from "../song-research-center";

export const metadata: Metadata = {
  title: "Mai-Score Song Research",
  description: "Search the maimai DX International catalog, browse chart constants, and analyze personal Full Records."
};

export default function SongsPage() {
  return <SongResearchCenter />;
}
