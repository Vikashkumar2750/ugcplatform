import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ContentIQ — UGC Content Intelligence for Indian Creators",
  description:
    "90 seconds mein jaano ki tumhara content kyun nahi grow kar raha. Profile audit, competitor analysis, trend research aur 7 ready-to-post scripts — sirf ₹9 mein.",
  keywords: [
    "ugc content strategy india",
    "instagram growth india",
    "content creator tools",
    "hindi content strategy",
    "instagram audit india",
    "youtube shorts strategy",
    "influencer marketing india",
  ],
  openGraph: {
    title: "ContentIQ — UGC Content Intelligence for Indian Creators",
    description: "AI-powered content strategy platform for Indian creators. ₹9 lifetime access.",
    type: "website",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={`${inter.variable} ${outfit.variable} font-sans antialiased min-h-screen`}>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
