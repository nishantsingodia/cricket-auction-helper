"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AuctionRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/");
  }, [router]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-muted-foreground">Redirecting to home...</p>
    </div>
  );
}
