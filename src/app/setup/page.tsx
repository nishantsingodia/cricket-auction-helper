"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const IPL_TEAMS = [
  { name: "Chennai Super Kings", shortName: "CSK", color: "#FFCB05" },
  { name: "Mumbai Indians", shortName: "MI", color: "#004BA0" },
  { name: "Royal Challengers Bengaluru", shortName: "RCB", color: "#EC1C24" },
  { name: "Kolkata Knight Riders", shortName: "KKR", color: "#3A225D" },
  { name: "Delhi Capitals", shortName: "DC", color: "#004C93" },
  { name: "Rajasthan Royals", shortName: "RR", color: "#EA1A85" },
  { name: "Sunrisers Hyderabad", shortName: "SRH", color: "#FF822A" },
  { name: "Punjab Kings", shortName: "PBKS", color: "#DD1F2D" },
  { name: "Lucknow Super Giants", shortName: "LSG", color: "#A72056" },
  { name: "Gujarat Titans", shortName: "GT", color: "#1C1C1C" },
];

interface TeamInput {
  name: string;
  shortName: string;
  color: string;
}

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1: Tournament Info
  const [name, setName] = useState("IPL 2026 Mega Auction");
  const [format, setFormat] = useState("IPL");
  const [matchFormat, setMatchFormat] = useState("T20");
  const [pursePerTeam, setPursePerTeam] = useState(120);
  const [currencyUnit, setCurrencyUnit] = useState("Cr");

  // Step 2: Teams
  const [numTeams, setNumTeams] = useState(10);
  const [teams, setTeams] = useState<TeamInput[]>(IPL_TEAMS);

  // Step 3: Rules
  const [maxSquadSize, setMaxSquadSize] = useState(25);
  const [maxOverseas, setMaxOverseas] = useState(4);
  const [maxOverseasSquad, setMaxOverseasSquad] = useState(8);
  const [numCaptains, setNumCaptains] = useState(1);
  const [numViceCaptains, setNumViceCaptains] = useState(1);

  // Step 4: Player Pool
  const [minMatches, setMinMatches] = useState(10);
  const [poolSize, setPoolSize] = useState<number | null>(null);

  const handleTeamCountChange = (count: number) => {
    setNumTeams(count);
    const newTeams = [...teams];
    while (newTeams.length < count) {
      newTeams.push({
        name: `Team ${newTeams.length + 1}`,
        shortName: `T${newTeams.length + 1}`,
        color: "#6366f1",
      });
    }
    setTeams(newTeams.slice(0, count));
  };

  const updateTeam = (idx: number, field: keyof TeamInput, value: string) => {
    const newTeams = [...teams];
    newTeams[idx] = { ...newTeams[idx], [field]: value };
    setTeams(newTeams);
  };

  const handleCreate = async () => {
    setLoading(true);
    try {
      // First, get player IDs for the pool
      const poolRes = await fetch(
        `/api/players?format=${matchFormat === "T20" ? "IPL" : matchFormat}&limit=1000&minMatches=${minMatches}&sortBy=efppm&sortDir=desc`
      );
      const poolData = await poolRes.json();
      const playerIds = poolData.players.map((p: { id: number; fantasy: { efppm: number } }) => ({
        id: p.id,
        basePrice: p.fantasy.efppm > 60 ? 2 : p.fantasy.efppm > 40 ? 1 : 0.5,
      }));

      setPoolSize(playerIds.length);

      // Create tournament
      const res = await fetch("/api/tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          format,
          matchFormat,
          pursePerTeam,
          currencyUnit,
          maxSquadSize,
          maxOverseas,
          maxOverseasSquad,
          numCaptains,
          numViceCaptains,
          teams: teams.slice(0, numTeams),
          playerIds,
        }),
      });

      const data = await res.json();

      if (data.tournament?.id) {
        // Initialize valuations
        await fetch(`/api/auction/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tournamentId: data.tournament.id }),
        });

        router.push(`/auction?tournamentId=${data.tournament.id}`);
      }
    } catch (err) {
      console.error("Failed to create tournament:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Tournament Setup</h1>
        <p className="text-muted-foreground mb-8">
          Configure your fantasy cricket auction
        </p>

        {/* Progress */}
        <div className="flex gap-2 mb-8">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`h-2 flex-1 rounded-full ${
                s <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Step 1: Tournament Info */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Tournament Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Tournament Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="IPL 2026 Mega Auction"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Tournament Type</Label>
                  <Select value={format} onValueChange={(v) => setFormat(v ?? "IPL")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="IPL">IPL / Franchise</SelectItem>
                      <SelectItem value="BILATERAL">Bilateral Series</SelectItem>
                      <SelectItem value="CUSTOM">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Match Format</Label>
                  <Select value={matchFormat} onValueChange={(v) => setMatchFormat(v ?? "T20")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="T20">T20</SelectItem>
                      <SelectItem value="ODI">ODI</SelectItem>
                      <SelectItem value="TEST">Test</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Purse per Team</Label>
                  <Input
                    type="number"
                    value={pursePerTeam}
                    onChange={(e) => setPursePerTeam(Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label>Currency Unit</Label>
                  <Select value={currencyUnit} onValueChange={(v) => setCurrencyUnit(v ?? "Cr")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cr">Crores</SelectItem>
                      <SelectItem value="L">Lakhs</SelectItem>
                      <SelectItem value="Credits">Credits</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={() => setStep(2)} className="w-full">
                Next: Teams
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Teams */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Teams / Participants</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Number of Teams</Label>
                <Input
                  type="number"
                  value={numTeams}
                  onChange={(e) =>
                    handleTeamCountChange(
                      Math.max(2, Math.min(20, Number(e.target.value)))
                    )
                  }
                  min={2}
                  max={20}
                />
              </div>
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {teams.slice(0, numTeams).map((team, idx) => (
                  <div key={idx} className="flex gap-3 items-center">
                    <input
                      type="color"
                      value={team.color}
                      onChange={(e) => updateTeam(idx, "color", e.target.value)}
                      className="w-10 h-10 rounded cursor-pointer border-0"
                    />
                    <Input
                      value={team.name}
                      onChange={(e) => updateTeam(idx, "name", e.target.value)}
                      placeholder="Team name"
                      className="flex-1"
                    />
                    <Input
                      value={team.shortName}
                      onChange={(e) =>
                        updateTeam(idx, "shortName", e.target.value)
                      }
                      placeholder="Short"
                      className="w-20"
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button onClick={() => setStep(3)} className="flex-1">
                  Next: Rules
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Rules */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Auction Rules</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Max Squad Size</Label>
                  <Input
                    type="number"
                    value={maxSquadSize}
                    onChange={(e) => setMaxSquadSize(Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label>Max Overseas in XI</Label>
                  <Input
                    type="number"
                    value={maxOverseas}
                    onChange={(e) => setMaxOverseas(Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label>Max Overseas in Squad</Label>
                  <Input
                    type="number"
                    value={maxOverseasSquad}
                    onChange={(e) => setMaxOverseasSquad(Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label>Min Matches for Pool</Label>
                  <Input
                    type="number"
                    value={minMatches}
                    onChange={(e) => setMinMatches(Number(e.target.value))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Captains per Team</Label>
                  <Input
                    type="number"
                    value={numCaptains}
                    onChange={(e) => setNumCaptains(Number(e.target.value))}
                    min={1}
                    max={5}
                  />
                </div>
                <div>
                  <Label>Vice-Captains per Team</Label>
                  <Input
                    type="number"
                    value={numViceCaptains}
                    onChange={(e) => setNumViceCaptains(Number(e.target.value))}
                    min={1}
                    max={5}
                  />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Captain gets 2x fantasy points, Vice-Captain gets 1.5x
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)}>
                  Back
                </Button>
                <Button onClick={() => setStep(4)} className="flex-1">
                  Next: Review
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Review & Create */}
        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle>Review & Create</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Tournament:</span>{" "}
                  <span className="font-medium">{name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Format:</span>{" "}
                  <span className="font-medium">{matchFormat}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Teams:</span>{" "}
                  <span className="font-medium">{numTeams}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Purse:</span>{" "}
                  <span className="font-medium">
                    {pursePerTeam} {currencyUnit}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Squad Size:</span>{" "}
                  <span className="font-medium">{maxSquadSize}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Max Overseas:</span>{" "}
                  <span className="font-medium">
                    {maxOverseas} (XI) / {maxOverseasSquad} (Squad)
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">C/VC per team:</span>{" "}
                  <span className="font-medium">
                    {numCaptains}C + {numViceCaptains}VC
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Min Matches:</span>{" "}
                  <span className="font-medium">{minMatches}</span>
                </div>
              </div>

              <div className="border rounded-lg p-3">
                <p className="text-sm font-medium mb-2">Teams:</p>
                <div className="flex flex-wrap gap-2">
                  {teams.slice(0, numTeams).map((t, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 px-3 py-1 rounded-full text-sm"
                      style={{ backgroundColor: t.color + "20", color: t.color }}
                    >
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: t.color }}
                      />
                      {t.shortName}
                    </div>
                  ))}
                </div>
              </div>

              {poolSize !== null && (
                <p className="text-sm text-green-400">
                  Player pool ready: {poolSize} players
                </p>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(3)}>
                  Back
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? "Creating Auction..." : "Create & Start Auction"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
