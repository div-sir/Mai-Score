import type { Metadata } from "next";
import PassportClient from "./passport-client";

export const metadata: Metadata = {
  title: "Player Passport · Mai-Score",
  description: "A privacy-first public rhythm-game profile built from your local Mai-Score data."
};

export default function PassportPage() {
  return <PassportClient />;
}
