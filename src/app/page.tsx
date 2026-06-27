"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ThemeToggle";

interface Auction {
  id: number;
  name: string;
  tournament_name: string;
  match_format: string;
  num_friends: number;
  purse_per_friend: number;
  players_per_friend: number;
  status: string;
  created_at: string;
  total_players: number;
  sold_players: number;
}

interface FriendInput {
  name: string;
  shortName: string;
  isMe: boolean;
}

export default function HomePage() {
  const router = useRouter();
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // Tournament options for the player pool source
  const TOURNAMENTS = [
    {
      id: "IPL 2026",
      label: "IPL 2026",
      format: "T20",
      note: "Squads auto-fetched from official sources",
    },
    {
      id: "Women's T20 WC 2026",
      label: "Women's T20 WC 2026",
      format: "T20",
      note: "10 nations · official announced squads",
    },
    {
      id: "MLC 2026",
      label: "MLC 2026",
      format: "T20",
      note: "6 USA franchises · valued on MLC 2023-25 + IPL/T20I",
    },
  ];

  // Create form state
  const [tournament, setTournament] = useState("IPL 2026");
  const [auctionName, setAuctionName] = useState("Friends IPL Draft 2026");
  const [numFriends, setNumFriends] = useState(4);
  const [purse, setPurse] = useState(120);
  const [playersPerFriend, setPlayersPerFriend] = useState(15);
  const [numCaptains, setNumCaptains] = useState(1);
  const [numViceCaptains, setNumViceCaptains] = useState(1);
  const [friends, setFriends] = useState<FriendInput[]>([
    { name: "", shortName: "", isMe: true },
    { name: "", shortName: "", isMe: false },
    { name: "", shortName: "", isMe: false },
    { name: "", shortName: "", isMe: false },
  ]);
  const [creating, setCreating] = useState(false);
  const [fetchingSquads, setFetchingSquads] = useState(false);

  useEffect(() => {
    fetch("/api/auctions")
      .then((r) => r.json())
      .then((data) => setAuctions(data.auctions || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Sync friends list with numFriends
  useEffect(() => {
    setFriends((prev) => {
      const next: FriendInput[] = [];
      for (let i = 0; i < numFriends; i++) {
        next.push(
          prev[i] || {
            name: "",
            shortName: "",
            isMe: i === 0 && !prev.some((f) => f.isMe),
          }
        );
      }
      // Ensure exactly one isMe
      if (!next.some((f) => f.isMe) && next.length > 0) {
        next[0].isMe = true;
      }
      return next;
    });
  }, [numFriends]);

  const updateFriend = (
    idx: number,
    field: keyof FriendInput,
    value: string | boolean
  ) => {
    setFriends((prev) => {
      const next = [...prev];
      if (field === "isMe") {
        next.forEach((f, i) => (f.isMe = i === idx));
      } else {
        next[idx] = { ...next[idx], [field]: value };
      }
      return next;
    });
  };

  const handleCreate = async () => {
    const filledFriends = friends.filter((f) => f.name.trim());
    if (filledFriends.length !== numFriends) {
      alert("Please fill in all friend names");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/auctions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: auctionName,
          numFriends,
          pursePerFriend: purse,
          playersPerFriend,
          numCaptains,
          numViceCaptains,
          tournamentName: tournament,
          matchFormat:
            TOURNAMENTS.find((t) => t.id === tournament)?.format || "T20",
          friends: friends.map((f) => ({
            name: f.name.trim(),
            shortName:
              f.shortName.trim() ||
              f.name.trim().substring(0, 3).toUpperCase(),
            isMe: f.isMe,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const auctionId = data.auctionId;

      // Fetch IPL squads
      setFetchingSquads(true);
      const fetchRes = await fetch("/api/pool/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auctionId }),
      });

      const fetchData = await fetchRes.json();
      if (!fetchRes.ok) {
        console.error("Squad fetch failed:", fetchData.error);
      }

      router.push(`/auction/${auctionId}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create auction");
      setCreating(false);
      setFetchingSquads(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center relative">
          <div className="absolute right-0 top-0">
            <ThemeToggle />
          </div>
          <h1 className="text-4xl font-bold text-foreground">
            Cricket Auction Helper
          </h1>
          <p className="text-muted-foreground mt-2">
            Fantasy Cricket Auction Intelligence Engine
          </p>
        </div>

        {/* Existing Auctions */}
        {!showCreate && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Your Auctions</h2>
              <Button size="lg" onClick={() => setShowCreate(true)}>
                + Create New Auction
              </Button>
            </div>

            {loading ? (
              <p className="text-muted-foreground text-center py-12">
                Loading...
              </p>
            ) : auctions.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground mb-4">
                    No auctions yet. Create your first one!
                  </p>
                  <Button onClick={() => setShowCreate(true)}>
                    Create New Auction
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {auctions.map((a) => (
                  <Card
                    key={a.id}
                    className="cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => router.push(`/auction/${a.id}`)}
                  >
                    <CardContent className="flex items-center justify-between py-4">
                      <div>
                        <h3 className="font-semibold text-lg">{a.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {a.tournament_name} &middot; {a.num_friends} friends
                          &middot; {a.purse_per_friend} Cr purse
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right text-sm">
                          <p className="font-medium">
                            {a.sold_players}/{a.total_players} sold
                          </p>
                          <p className="text-muted-foreground">
                            {new Date(a.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge
                          variant={
                            a.status === "COMPLETED"
                              ? "default"
                              : a.status === "LIVE"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {a.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Create New Auction */}
        {showCreate && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Create New Auction</h2>
              <Button variant="ghost" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Tournament</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {TOURNAMENTS.map((t) => {
                    const selected = tournament === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTournament(t.id)}
                        className={`text-left rounded-lg border p-3 transition-colors ${
                          selected
                            ? "border-primary bg-primary/10"
                            : "border-border hover:bg-muted/40"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{t.label}</span>
                          <Badge variant="outline" className="text-xs">
                            {t.format}
                          </Badge>
                          {selected && (
                            <Badge className="text-xs ml-auto">Selected</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t.note}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Auction Setup</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">
                    Auction Name
                  </label>
                  <Input
                    value={auctionName}
                    onChange={(e) => setAuctionName(e.target.value)}
                    placeholder="e.g., Friends IPL Draft 2026"
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      Friends
                    </label>
                    <Input
                      type="number"
                      min={2}
                      max={10}
                      value={numFriends}
                      onChange={(e) =>
                        setNumFriends(
                          Math.max(
                            2,
                            Math.min(10, parseInt(e.target.value) || 2)
                          )
                        )
                      }
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      Purse (Cr)
                    </label>
                    <Input
                      type="number"
                      min={10}
                      value={purse}
                      onChange={(e) =>
                        setPurse(parseFloat(e.target.value) || 120)
                      }
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      Players/Friend
                    </label>
                    <Input
                      type="number"
                      min={5}
                      max={25}
                      value={playersPerFriend}
                      onChange={(e) =>
                        setPlayersPerFriend(parseInt(e.target.value) || 15)
                      }
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      C / VC
                    </label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min={0}
                        max={3}
                        value={numCaptains}
                        onChange={(e) =>
                          setNumCaptains(parseInt(e.target.value) || 1)
                        }
                        className="w-16"
                        title="Captains"
                      />
                      <Input
                        type="number"
                        min={0}
                        max={3}
                        value={numViceCaptains}
                        onChange={(e) =>
                          setNumViceCaptains(parseInt(e.target.value) || 1)
                        }
                        className="w-16"
                        title="Vice-Captains"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Friends</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {friends.map((f, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground w-6">
                      {i + 1}.
                    </span>
                    <Input
                      value={f.name}
                      onChange={(e) => updateFriend(i, "name", e.target.value)}
                      placeholder={`Friend ${i + 1} name`}
                      className="flex-1"
                    />
                    <Input
                      value={f.shortName}
                      onChange={(e) =>
                        updateFriend(i, "shortName", e.target.value)
                      }
                      placeholder="Short"
                      className="w-20"
                      maxLength={4}
                    />
                    <label className="flex items-center gap-1 cursor-pointer text-sm whitespace-nowrap">
                      <input
                        type="radio"
                        name="isMe"
                        checked={f.isMe}
                        onChange={() => updateFriend(i, "isMe", true)}
                        className="accent-green-500"
                      />
                      Me
                    </label>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Button
              size="lg"
              className="w-full"
              onClick={handleCreate}
              disabled={creating}
            >
              {fetchingSquads
                ? "Fetching IPL Squads..."
                : creating
                  ? "Creating Auction..."
                  : "Create Auction & Fetch Squads"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
