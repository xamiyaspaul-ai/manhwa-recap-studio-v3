"use client";

import { Wifi, WifiOff } from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

interface ConnectionIndicatorProps {
  connected: boolean;
}

export function ConnectionIndicator({ connected }: ConnectionIndicatorProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-border bg-card/50 hover:bg-card/80 transition-colors cursor-default">
          {connected ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="glow-pulse absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <Wifi className="h-3 w-3 text-emerald-400" />
              <span className="text-[10px] font-medium text-emerald-400 hidden sm:inline">
                Live
              </span>
            </>
          ) : (
            <>
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              <WifiOff className="h-3 w-3 text-rose-400" />
              <span className="text-[10px] font-medium text-rose-400 hidden sm:inline">
                Offline
              </span>
            </>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {connected
          ? "Connected to pipeline service"
          : "Pipeline service disconnected"}
      </TooltipContent>
    </Tooltip>
  );
}
