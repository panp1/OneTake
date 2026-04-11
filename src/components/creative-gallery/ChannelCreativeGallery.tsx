"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
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
  requestId: string;
}

export default function ChannelCreativeGallery({
  assets,
  requestId,
}: ChannelCreativeGalleryProps) {
  const router = useRouter();
  const activeChannels = useMemo(() => getActiveChannels(assets), [assets]);

  const [activeChannel, setActiveChannel] = useState<string>(
    activeChannels[0] || "",
  );

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

  // Navigate to studio page on thumbnail click
  const handleAssetClick = useCallback(
    (asset: GeneratedAsset) => {
      router.push(`/intake/${requestId}/studio/${asset.id}`);
    },
    [router, requestId],
  );

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
              onAssetClick={handleAssetClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}
