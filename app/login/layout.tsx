import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login — ContentIQ",
  description: "Sign in to ContentIQ — India's #1 AI content strategy platform",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
