"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { PixelButton } from "./PixelButton";
import { PixelInput } from "./PixelInput";
import { PixelDialog } from "./PixelDialog";
import type { CustomLevel } from "../types";
import { DEFAULT_LEVEL } from "../lib/gameConfig";

// Minimum display size for the map in the editor
const MIN_DISPLAY_WIDTH = 800;
const MIN_DISPLAY_HEIGHT = 600;

// Facility templates that users can place
const FACILITY_TEMPLATES = [
  {
    id: "mine",
    displayName: "Mine",
    emoji: "⛏️",
    defaultPrompt: "Enter the mine to gather resources",
    interactionName: "mine",
    interactionDurationMillis: 3000,
  },
  {
    id: "general-shop",
    displayName: "General Shop",
    emoji: "🏪",
    defaultPrompt: "Buy and sell items at the general shop",
    interactionName: "trade",
    interactionDurationMillis: 2000,
  },
  {
    id: "community-furnace",
    displayName: "Furnace",
    emoji: "🔥",
    defaultPrompt: "Smelt ores and craft items",
    interactionName: "smelt",
    interactionDurationMillis: 5000,
  },
  {
    id: "market-stalls",
    displayName: "Market",
    emoji: "🛒",
    defaultPrompt: "Trade with other villagers",
    interactionName: "market",
    interactionDurationMillis: 2000,
  },
  {
    id: "farm",
    displayName: "Farm",
    emoji: "🌾",
    defaultPrompt: "Grow and harvest crops",
    interactionName: "farm",
    interactionDurationMillis: 4000,
  },
  {
    id: "forest",
    displayName: "Forest",
    emoji: "🌲",
    defaultPrompt: "Gather wood and forage for items",
    interactionName: "forage",
    interactionDurationMillis: 3000,
  },
  {
    id: "river",
    displayName: "River",
    emoji: "🎣",
    defaultPrompt: "Fish or collect water",
    interactionName: "fish",
    interactionDurationMillis: 4000,
  },
];

type PlacedFacility = {
  id: string;
  templateId: string;
  x: number;
  y: number;
  displayName: string;
  emoji: string;
  interactionPrompt: string;
  interactionName: string;
  interactionDurationMillis: number;
};

// Pending facility waiting for customization
type PendingFacility = {
  templateId: string;
  x: number;
  y: number;
  emoji: string;
  interactionName: string;
  interactionDurationMillis: number;
  defaultName: string;
  defaultPrompt: string;
};

interface LevelEditorProps {
  backgroundImageUrl: string;
  onCreateGame: (levelConfig: CustomLevel) => void;
  onBack: () => void;
  isCreating: boolean;
}

export function LevelEditor({
  backgroundImageUrl,
  onCreateGame,
  onBack,
  isCreating,
}: LevelEditorProps) {
  const [placedFacilities, setPlacedFacilities] = useState<PlacedFacility[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [draggingFacility, setDraggingFacility] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Customization dialog state
  const [pendingFacility, setPendingFacility] = useState<PendingFacility | null>(null);
  const [customName, setCustomName] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");

  // Calculate display dimensions - scale up small images to fill editor
  const displayDimensions = imageDimensions
    ? {
      width: Math.max(imageDimensions.width, MIN_DISPLAY_WIDTH),
      height: Math.max(imageDimensions.height, MIN_DISPLAY_HEIGHT),
    }
    : { width: MIN_DISPLAY_WIDTH, height: MIN_DISPLAY_HEIGHT };

  // Calculate the display scale factor (how much we're scaling the image for display)
  const displayScaleFactor = imageDimensions
    ? Math.max(
      displayDimensions.width / imageDimensions.width,
      displayDimensions.height / imageDimensions.height
    )
    : 1;

  // Scale for world units: this determines how pixels in the ORIGINAL image map to world units
  // We use the original image dimensions for consistency with game view
  const scale = imageDimensions
    ? Math.min(imageDimensions.width, imageDimensions.height) / 1000
    : DEFAULT_LEVEL.backgroundImage.scale;

  // Check if a facility type is already placed
  const isTemplatePlaced = useCallback(
    (templateId: string) => {
      return placedFacilities.some((f) => f.templateId === templateId);
    },
    [placedFacilities]
  );

  // Load image to get dimensions
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = backgroundImageUrl;
  }, [backgroundImageUrl]);

  const handleMapClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!selectedTemplate || !mapContainerRef.current) return;

      // Check if this facility type is already placed
      if (isTemplatePlaced(selectedTemplate)) {
        setSelectedTemplate(null);
        return;
      }

      const rect = mapContainerRef.current.getBoundingClientRect();
      const displayPixelX = e.clientX - rect.left;
      const displayPixelY = e.clientY - rect.top;

      // Convert display pixels to original image pixels, then to world units
      const originalPixelX = displayPixelX / displayScaleFactor;
      const originalPixelY = displayPixelY / displayScaleFactor;
      const worldX = originalPixelX * scale;
      const worldY = originalPixelY * scale;

      const template = FACILITY_TEMPLATES.find((t) => t.id === selectedTemplate);
      if (!template) return;

      // Set up pending facility and show customization dialog
      setPendingFacility({
        templateId: template.id,
        x: Math.round(worldX),
        y: Math.round(worldY),
        emoji: template.emoji,
        interactionName: template.interactionName,
        interactionDurationMillis: template.interactionDurationMillis,
        defaultName: template.displayName,
        defaultPrompt: template.defaultPrompt,
      });
      setCustomName(template.displayName);
      setCustomPrompt(template.defaultPrompt);
      setSelectedTemplate(null);
    },
    [selectedTemplate, scale, displayScaleFactor, isTemplatePlaced]
  );

  // Confirm and save the customized facility
  const confirmFacility = useCallback(() => {
    if (!pendingFacility) return;

    const newFacility: PlacedFacility = {
      id: pendingFacility.templateId,
      templateId: pendingFacility.templateId,
      x: pendingFacility.x,
      y: pendingFacility.y,
      displayName: customName.trim() || pendingFacility.defaultName,
      emoji: pendingFacility.emoji,
      interactionPrompt: customPrompt.trim() || pendingFacility.defaultPrompt,
      interactionName: pendingFacility.interactionName,
      interactionDurationMillis: pendingFacility.interactionDurationMillis,
    };

    setPlacedFacilities((prev) => [...prev, newFacility]);
    setPendingFacility(null);
    setCustomName("");
    setCustomPrompt("");
  }, [pendingFacility, customName, customPrompt]);

  // Cancel facility placement
  const cancelFacility = useCallback(() => {
    setPendingFacility(null);
    setCustomName("");
    setCustomPrompt("");
  }, []);

  const handleFacilityDrag = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, facilityId: string) => {
      e.stopPropagation();
      setDraggingFacility(facilityId);
    },
    []
  );

  const handleMapMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!draggingFacility || !mapContainerRef.current) return;

      const rect = mapContainerRef.current.getBoundingClientRect();
      const displayPixelX = e.clientX - rect.left;
      const displayPixelY = e.clientY - rect.top;

      // Convert display pixels to original image pixels, then to world units
      const originalPixelX = displayPixelX / displayScaleFactor;
      const originalPixelY = displayPixelY / displayScaleFactor;
      const worldX = originalPixelX * scale;
      const worldY = originalPixelY * scale;

      setPlacedFacilities((prev) =>
        prev.map((f) =>
          f.id === draggingFacility
            ? { ...f, x: Math.round(worldX), y: Math.round(worldY) }
            : f
        )
      );
    },
    [draggingFacility, scale, displayScaleFactor]
  );

  const handleMapMouseUp = useCallback(() => {
    setDraggingFacility(null);
  }, []);

  const removeFacility = useCallback((facilityId: string) => {
    setPlacedFacilities((prev) => prev.filter((f) => f.id !== facilityId));
  }, []);

  const handleCreateGame = useCallback(() => {
    // Build the facilities object for the level config
    const facilities: CustomLevel["facilities"] = {};
    placedFacilities.forEach((f) => {
      facilities[f.id] = {
        x: f.x,
        y: f.y,
        displayName: f.displayName,
        interactionPrompt: f.interactionPrompt,
        interactionName: f.interactionName,
        interactionDurationMillis: f.interactionDurationMillis,
        variables: {},
      };
    });

    // Calculate world dimensions based on image
    const worldWidth = imageDimensions ? Math.round(imageDimensions.width * scale) : DEFAULT_LEVEL.width;
    const worldHeight = imageDimensions ? Math.round(imageDimensions.height * scale) : DEFAULT_LEVEL.height;

    const levelConfig: CustomLevel = {
      ...DEFAULT_LEVEL,
      width: worldWidth,
      height: worldHeight,
      backgroundImage: {
        url: backgroundImageUrl,
        scale: scale,
      },
      facilities,
    };

    onCreateGame(levelConfig);
  }, [placedFacilities, backgroundImageUrl, scale, imageDimensions, onCreateGame]);

  return (
    <div className="fixed inset-0 bg-slate-900 z-50 flex">
      {/* Left Sidebar - Facility Palette */}
      <div className="w-64 bg-slate-800 border-r-4 border-slate-600 flex flex-col">
        <div className="p-4 border-b-2 border-slate-600">
          <h2 className="text-white font-bold text-lg mb-1">Level Editor</h2>
          <p className="text-slate-400 text-xs">
            Click a facility, then click on the map to place it
          </p>
        </div>

        {/* Facility Templates */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <p className="text-slate-500 text-xs uppercase tracking-wide mb-2">
            Facilities
          </p>
          {FACILITY_TEMPLATES.map((template) => {
            const alreadyPlaced = isTemplatePlaced(template.id);
            return (
              <button
                key={template.id}
                onClick={() => {
                  if (!alreadyPlaced) {
                    setSelectedTemplate(
                      selectedTemplate === template.id ? null : template.id
                    );
                  }
                }}
                disabled={alreadyPlaced}
                className={`w-full p-3 rounded border-2 text-left transition-all ${alreadyPlaced
                  ? "bg-slate-800/50 border-slate-700 text-slate-500 cursor-not-allowed"
                  : selectedTemplate === template.id
                    ? "bg-emerald-900/50 border-emerald-500 text-emerald-300"
                    : "bg-slate-700/50 border-slate-600 text-white hover:border-slate-500"
                  }`}
              >
                <span className="text-lg mr-2">{template.emoji}</span>
                <span className="text-sm font-medium">{template.displayName}</span>
                {alreadyPlaced && (
                  <span className="text-xs ml-2 text-emerald-500">✓ Placed</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Placed Facilities List */}
        <div className="border-t-2 border-slate-600 p-4 max-h-48 overflow-y-auto">
          <p className="text-slate-500 text-xs uppercase tracking-wide mb-2">
            Placed ({placedFacilities.length})
          </p>
          {placedFacilities.length === 0 ? (
            <p className="text-slate-500 text-xs italic">No facilities placed yet</p>
          ) : (
            <div className="space-y-1">
              {placedFacilities.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between bg-slate-700/50 px-2 py-1 rounded text-xs"
                >
                  <span className="text-white">
                    {f.emoji} {f.displayName}
                  </span>
                  <button
                    onClick={() => removeFacility(f.id)}
                    className="text-red-400 hover:text-red-300 px-1"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-4 border-t-2 border-slate-600 space-y-2">
          <PixelButton
            onClick={handleCreateGame}
            disabled={isCreating || placedFacilities.length === 0}
            className="w-full"
          >
            {isCreating ? "Creating..." : `🎮 Create Game`}
          </PixelButton>
          <PixelButton variant="secondary" onClick={onBack} className="w-full">
            ← Back
          </PixelButton>
        </div>
      </div>

      {/* Map Area */}
      <div className="flex-1 overflow-auto bg-slate-950 p-4 flex items-center justify-center">
        <div
          ref={mapContainerRef}
          className={`relative ${selectedTemplate ? "cursor-crosshair" : ""}`}
          style={{
            width: `${displayDimensions.width}px`,
            height: `${displayDimensions.height}px`,
          }}
          onClick={handleMapClick}
          onMouseMove={handleMapMouseMove}
          onMouseUp={handleMapMouseUp}
          onMouseLeave={handleMapMouseUp}
        >
          {/* Background Image */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={backgroundImageUrl}
            alt="Level background"
            className="absolute inset-0 w-full h-full object-cover"
            draggable={false}
          />

          {/* Placed Facilities Markers */}
          {placedFacilities.map((facility) => {
            // Convert world units back to original pixels, then to display pixels
            const originalPixelX = facility.x / scale;
            const originalPixelY = facility.y / scale;
            const displayPixelX = originalPixelX * displayScaleFactor;
            const displayPixelY = originalPixelY * displayScaleFactor;

            return (
              <div
                key={facility.id}
                className={`absolute transform -translate-x-1/2 -translate-y-1/2 cursor-move ${draggingFacility === facility.id ? "scale-110" : ""
                  }`}
                style={{
                  left: `${displayPixelX}px`,
                  top: `${displayPixelY}px`,
                  zIndex: draggingFacility === facility.id ? 100 : 10,
                }}
                onMouseDown={(e) => handleFacilityDrag(e, facility.id)}
              >
                {/* Marker */}
                <div className="relative group">
                  <div className="w-10 h-10 rounded-full bg-slate-900/90 border-2 border-emerald-500 flex items-center justify-center text-xl shadow-lg">
                    {facility.emoji}
                  </div>
                  {/* Label */}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-slate-900/90 px-2 py-0.5 rounded text-xs text-white whitespace-nowrap border border-slate-600">
                    {facility.displayName}
                  </div>
                  {/* Delete button on hover */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFacility(facility.id);
                    }}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 hover:bg-red-500 rounded-full text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}

          {/* Selection indicator */}
          {selectedTemplate && (
            <div className="absolute top-4 left-4 bg-emerald-900/90 border border-emerald-500 px-3 py-2 rounded text-emerald-300 text-sm">
              Click on the map to place:{" "}
              <span className="font-bold">
                {FACILITY_TEMPLATES.find((t) => t.id === selectedTemplate)?.emoji}{" "}
                {FACILITY_TEMPLATES.find((t) => t.id === selectedTemplate)?.displayName}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Facility Customization Dialog */}
      <PixelDialog
        isOpen={pendingFacility !== null}
        onClose={cancelFacility}
        title={`Customize ${pendingFacility?.emoji || ""} Facility`}
      >
        <div className="space-y-4">
          <p className="text-slate-400 text-xs">
            Customize this facility&apos;s name and interaction prompt. The prompt tells Pookies what they can do here.
          </p>

          <PixelInput
            label="Facility Name"
            placeholder={pendingFacility?.defaultName || "Enter name..."}
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            autoFocus
          />

          <div className="w-full">
            <label className="block text-white text-sm font-bold mb-2 uppercase tracking-wider">
              Interaction Prompt
            </label>
            <textarea
              className="w-full px-4 py-3 bg-slate-800 border-2 border-slate-600 text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-none resize-none"
              rows={3}
              placeholder={pendingFacility?.defaultPrompt || "Enter prompt..."}
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
            />
            <p className="mt-1 text-slate-500 text-xs">
              This tells Pookies what they can do at this location
            </p>
          </div>

          <div className="flex gap-3">
            <PixelButton
              onClick={confirmFacility}
              disabled={!customName.trim()}
              className="flex-1"
            >
              {pendingFacility?.emoji} Place Facility
            </PixelButton>
            <PixelButton
              variant="secondary"
              onClick={cancelFacility}
              className="flex-1"
            >
              Cancel
            </PixelButton>
          </div>
        </div>
      </PixelDialog>
    </div>
  );
}
