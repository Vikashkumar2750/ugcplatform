import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Data Deletion Status — ContentIQ",
};

export default async function DataDeletionStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="font-heading text-2xl font-bold">Data Deletion Request Received</h1>
        <p className="text-muted-foreground">
          Your data deletion request has been processed. All data associated with your Facebook account has been permanently removed from ContentIQ.
        </p>
        {code && (
          <p className="text-xs text-muted-foreground">
            Confirmation code: <code className="bg-muted px-1.5 py-0.5 rounded font-mono">{code}</code>
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          If you have any questions, contact us at{" "}
          <a href="mailto:privacy@contentiq.app" className="text-amber-600 dark:text-amber-400 hover:underline">
            privacy@contentiq.app
          </a>
        </p>
      </div>
    </div>
  );
}
