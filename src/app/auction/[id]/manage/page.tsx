"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Participant {
  id: number;
  name: string;
  short_name: string;
  color: string | null;
  purse: number;
  remaining_purse: number;
  is_me: number;
}

interface PoolEntry {
  player_id: number;
  name: string;
  ipl_team: string;
  status: string;
  sold_to_participant: number | null;
  sold_price: number | null;
}

interface AuctionData {
  auction: { id: number; name: string; purse_per_friend: number };
  participants: Participant[];
  pool: PoolEntry[];
}

export default function ManageSoldPage() {
  const params = useParams();
  const router = useRouter();
  const auctionId = Number(params.id);

  const [data, setData] = useState<AuctionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/auction/${auctionId}`);
    const json = await res.json();
    setData(json);
    setLoading(false);
  }, [auctionId]);

  useEffect(() => {
    load();
  }, [load]);

  const removeSale = async (playerId: number, playerName: string) => {
    if (!confirm(`Remove ${playerName} from this squad and refund the purse?`)) return;
    setBusy(playerId);
    try {
      const res = await fetch("/api/auction/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auctionId, playerId }),
      });
      if (!res.ok) {
        const e = await res.json();
        alert(e.error || "Failed to remove");
      }
      await load();
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return <div className="p-6 text-muted-foreground">Loading…</div>;
  }
  if (!data) {
    return <div className="p-6 text-red-500">Could not load auction.</div>;
  }

  const sold = data.pool.filter(
    (p) => p.status === "SOLD" && p.sold_to_participant != null
  );

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Manage Sold Players</h1>
            <p className="text-sm text-muted-foreground">
              {data.auction.name} — remove a sale to refund the buyer&apos;s purse
            </p>
          </div>
          <Button variant="outline" onClick={() => router.push(`/auction/${auctionId}`)}>
            ← Back to auction
          </Button>
        </div>

        <div className="grid gap-4">
          {[...data.participants]
            .sort((a, b) => b.is_me - a.is_me || a.name.localeCompare(b.name))
            .map((par) => {
              const players = sold
                .filter((p) => p.sold_to_participant === par.id)
                .sort((a, b) => (b.sold_price ?? 0) - (a.sold_price ?? 0));
              const spent = players.reduce((s, p) => s + (p.sold_price ?? 0), 0);
              return (
                <Card key={par.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between text-base">
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block w-3 h-3 rounded-full"
                          style={{ backgroundColor: par.color || "#888" }}
                        />
                        {par.name}
                        {par.is_me ? (
                          <Badge className="text-[10px]">me</Badge>
                        ) : null}
                      </span>
                      <span className="text-sm font-normal text-muted-foreground">
                        {players.length} players · spent {spent} · left{" "}
                        <span className="font-semibold text-foreground">
                          {par.remaining_purse}
                        </span>
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {players.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No players yet.</p>
                    ) : (
                      <div className="divide-y">
                        {players.map((p) => (
                          <div
                            key={p.player_id}
                            className="flex items-center justify-between py-1.5"
                          >
                            <span className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px]">
                                {p.ipl_team}
                              </Badge>
                              <span>{p.name}</span>
                            </span>
                            <span className="flex items-center gap-3">
                              <span className="tabular-nums font-medium">
                                {p.sold_price}
                              </span>
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={busy === p.player_id}
                                onClick={() => removeSale(p.player_id, p.name)}
                              >
                                {busy === p.player_id ? "…" : "Remove"}
                              </Button>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
        </div>
      </div>
    </div>
  );
}
