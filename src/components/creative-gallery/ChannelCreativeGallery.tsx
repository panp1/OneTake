"use client";

import { useState, useMemo } from "react";
import type { GeneratedAsset } from "@/lib/types";
import {
  getActiveChannels,
  groupCreativesByVersion,
  CHANNEL_DEFINITIONS,
} from "@/lib/channels";
import ChannelTabBar from "./ChannelTabBar";
import VersionCard from "./VersionCard";

interface ChannelCreativeGalleryProps {
  assets: GeneratedAsset[];
  onAssetClick: (asset: GeneratedAsset) => void;
}

export default function ChannelCreativeGallery({
  assets,
  onAssetClick,
}: ChannelCreativeGalleryProps) {
  const activeChannels = useMemo(
    () => getActiveChannels(assets),
    [assets],
  );

  const [activeChannel, setActiveChannel] = useState<string>(
    activeChannels[0] || "",
  );

  // Reset to first channel if active channel becomes unavailable
  const resolvedChannel = activeChannels.includes(activeChannel)
    ? activeChannel
    : activeChannels[0] || "";

  const versions = useMemo(
    () =>
      resolvedChannel
        ? groupCreativesByVersion(assets, resolvedChannel)
        : [],
    [assets, resolvedChannel],
  );

  const channelDef = CHANNEL_DEFINITIONS[resolvedChannel];

  if (activeChannels.length === 0) {
    return (
      <div className="text-center py-12 text-[#999] text-sm">
        No composed creatives yet. Run the pipeline to generate creatives.
      </div>
    );
  }

  return (
    <div>
      <ChannelTabBar
        channels={activeChannels}
        activeChannel={resolvedChannel}
        onChannelChange={(ch) => setActiveChannel(ch)}
      />

      {versions.length === 0 ? (
        <div className="text-center py-8 text-[#999] text-sm">
          No creatives for {resolvedChannel} yet.
        </div>
      ) : (
        <div>
          {versions.map((version) => (
            <VersionCard
              key={version.versionLabel}
              version={version}
              channelDef={channelDef}
              onAssetClick={onAssetClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}
