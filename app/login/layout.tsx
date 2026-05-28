import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login — Content Engineer",
  description: "Sign in to Content Engineer — India's #1 AI content strategy platform",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
