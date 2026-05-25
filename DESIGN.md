---
name: Brain Indexer
description: PARA staging command center for local-first AI knowledge retrieval.
colors:
  primary: "#8b5cf6"
  primary-hover: "#7c3aed"
  bg-deep: "#080c14"
  bg-surface: "#0f172a"
  bg-surface-elevated: "#1e293b"
  text-primary: "#f8fafc"
  text-secondary: "#94a3b8"
  text-muted: "#64748b"
  success: "#10b981"
  danger: "#ef4444"
  warning: "#f59e0b"
typography:
  display:
    fontFamily: "Outfit, sans-serif"
    fontWeight: 600
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Inter, sans-serif"
    fontSize: "14px"
    lineHeight: 1.5
rounded:
  sm: "6px"
  md: "12px"
  lg: "16px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  button-secondary:
    backgroundColor: "{colors.bg-surface-elevated}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  card:
    backgroundColor: "rgba(15, 23, 42, 0.65)"
    rounded: "{rounded.lg}"
    padding: "24px"
---

# Design System: Brain Indexer

## 1. Overview

**Creative North Star: "The Private Archive Forge"**

The Brain Indexer interface is built to feel like a high-end terminal utility wrapped in a premium desktop experience. It prioritizes the "Zero-Exposure" security principle, using a deep, layered dark mode that suggests a secure, private vault. The aesthetic is "Obsidian/Electric"—a foundation of deep, muted blues and blacks punctuated by high-energy violet and emerald accents.

**Key Characteristics:**
- **Mechanical Density**: High-information density that respects user expertise.
- **Glassmorphism Depth**: Subtle blurs and translucent panels to create a sense of layering.
- **Electric Precision**: Vibrant accents used sparingly but forcefully to indicate action and status.

## 2. Colors

The palette is anchored in deep, "Obsidian" neutrals with high-chroma "Electric" accents.

### Primary
- **Electric Amethyst** (#8b5cf6): The primary brand color, used for main actions and active states. It represents the "spark" of AI intelligence.

### Secondary
- **Deep Space Indigo** (#0f172a): Used for the main surface area of the application.

### Neutral
- **Obsidian Night** (#080c14): The deep background color, providing the ultimate contrast for content.
- **Slate Text** (#94a3b8): Secondary text color for lower-priority information.

**The Ten Percent Rule.** The primary Electric Amethyst accent is used on ≤10% of any given screen. Its rarity is the point; it draws the eye to the most important actions.

## 3. Typography

**Display Font:** Outfit (with sans-serif fallbacks)
**Body Font:** Inter (with sans-serif fallbacks)

**Character:** A pairing of geometric clarity (Outfit) and functional precision (Inter).

### Hierarchy
- **Display** (600, 28px): Used for primary tab titles and section headers.
- **Headline** (600, 18px): Used for sidebar headings and card titles.
- **Body** (400, 14px): The standard reading size for all primary content.
- **Label** (500, 11px, 0.05em, uppercase): Used for sub-headers and metadata.

## 4. Elevation

Brain Indexer uses a "Glass-First" elevation strategy. Depth is conveyed through translucent panels with backdrop blurs rather than traditional drop shadows.

### Shadow Vocabulary
- **Primary Glow** (0 0 15px rgba(139, 92, 246, 0.3)): Used behind the primary logo and active primary buttons to suggest energy.

**The Flat-By-Default Rule.** Surfaces are flat at rest. Glassmorphism and glows appear only to separate distinct functional layers (Sidebar vs. Main Content).

## 5. Components

### Buttons
- **Shape:** Soft Geometric (12px radius)
- **Primary:** Electric Amethyst background with white text.
- **Secondary:** Surface Elevated background with subtle borders.

### Cards / Containers
- **Glass Panel:** 65% opacity surface with 12px blur.
- **Corner Style:** Large (16px radius) for main containers, Medium (12px) for nested items.

### Navigation
- **Sidebar Tabs:** High-contrast active state with left-aligned icons.
- **System Console:** Monospaced logs in a dark, recessed panel.

## 6. Do's and Don'ts

### Do:
- **Do** use OKLCH for any new color derivations to maintain perceptual lightness.
- **Do** use monospaced fonts for any system-level feedback or logs.
- **Do** maintain a consistent line length for documentation (65-75ch).

### Don't:
- **Don't** use border-left greater than 1px as a colored stripe on cards.
- **Don't** use generic SaaS landing-page clichés like "hero-metric" templates.
- **Don't** use pure black (#000) or pure white (#fff). Always tint neutrals toward the brand indigo.
