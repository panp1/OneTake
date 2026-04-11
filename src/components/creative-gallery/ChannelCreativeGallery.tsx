"use client";

import { useState, useMemo, useCallback } from "react";
import type { GeneratedAsset } from "@/lib/types";
import {
  getActiveChannels,
  groupCreativesByVersion,
  CHANNEL_DEFINITIONS,
  type VersionGroup,
} from "@/lib/channels";
import ChannelTabBar from "./ChannelTabBar";
import VersionCard from "./VersionCard";
import CreativeSidePanel from "./CreativeSidePanel";

interface ChannelCreativeGalleryProps {
  assets: GeneratedAsset[];
  onAssetClick?: (asset: GeneratedAsset) => void;
  onRefine?: (asset: GeneratedAsset) => void;
  onDelete?: (asset: GeneratedAsset) => void;
  onEditHtml?: (asset: GeneratedAsset) => void;
}

export default function ChannelCreativeGallery({
  assets,
  onRefine,
  onDelete,
  onEditHtml,
}: ChannelCreativeGalleryProps) {
  const activeChannels = useMemo(() => getActiveChannels(assets), [assets]);

  const [activeChannel, setActiveChannel] = useState<string>(
    activeChannels[0] || "",
  );
  const [selectedVersion, setSelectedVersion] = useState<{
    version: VersionGroup;
    initialAsset: GeneratedAsset;
  } | null>(null);

  const resolvedChannel = activeChannels.includes(activeChannel)
    ? activeChannel
    : activeChannels[0] || "";

  const versions = useMemo(
    () => resolvedChannel ? groupCreativesByVersion(assets, resolvedChannel) : [],
    [assets, resolvedChannel],
  );

  const channelDef = CHANNEL_DEFINITIONS[resolvedChannel];

  // When a thumbnail is clicked, find its version and open side panel
  const handleAssetClick = useCallback(
    (asset: GeneratedAsset) => {
      const version = versions.find((v) =>
        v.assets.some((a) => a.id === asset.id),
      );
      if (version) {
        setSelectedVersion({ version, initialAsset: asset });
      }
    },
    [versions],
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

      {/* Side Panel */}
      {selectedVersion && (
        <CreativeSidePanel
          version={selectedVersion.version}
          channelDef={channelDef}
          initialAsset={selectedVersion.initialAsset}
          onClose={() => setSelectedVersion(null)}
          onRefine={onRefine}
          onDelete={(asset) => {
            onDelete?.(asset);
            setSelectedVersion(null);
          }}
          onEditHtml={onEditHtml}
        />
      )}
    </div>
  );
}
