"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface Participant {
  id: number;
  name: string;
  short_name: string;
  color: string;
  remaining_purse: number;
  is_me: boolean | number;
}

interface SellDialogProps {
  open: boolean;
  onClose: () => void;
  playerName: string;
  playerId: number;
  basePrice: number;
  auctionId: number;
  participants: Participant[];
  onSold: () => void;
}

export function SellDialog({
  open,
  onClose,
  playerName,
  playerId,
  basePrice,
  auctionId,
  participants,
  onSold,
}: SellDialogProps) {
  const [selectedParticipant, setSelectedParticipant] = useState<number | null>(
    null
  );
  const [price, setPrice] = useState(basePrice || 0);
  const [selling, setSelling] = useState(false);
  const [error, setError] = useState("");

  const handleSell = async () => {
    if (!selectedParticipant) {
      setError("Select a friend");
      return;
    }
    if (price <= 0) {
      setError("Enter a valid price");
      return;
    }

    setSelling(true);
    setError("");

    try {
      const res = await fetch("/api/auction/sell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auctionId,
          playerId,
          participantId: selectedParticipant,
          price,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      onSold();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sell");
    } finally {
      setSelling(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Sell {playerName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Price */}
          <div>
            <label className="text-sm font-medium mb-1 block">
              Price (Cr)
            </label>
            <Input
              type="number"
              step={0.25}
              min={0}
              value={price}
              onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
              autoFocus
            />
          </div>

          {/* Friend selector */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Sold to
            </label>
            <div className="grid grid-cols-2 gap-2">
              {participants.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedParticipant(p.id)}
                  className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-colors ${
                    selectedParticipant === p.id
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: p.color }}
                  />
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">
                      {p.name}
                      {p.is_me ? (
                        <Badge
                          variant="outline"
                          className="ml-1 text-[10px] px-1 py-0"
                        >
                          ME
                        </Badge>
                      ) : null}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {p.remaining_purse.toFixed(1)} Cr left
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSell}
              disabled={selling || !selectedParticipant}
              className="flex-1"
            >
              {selling ? "Selling..." : "Confirm Sale"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
