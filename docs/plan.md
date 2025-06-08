# 📘 HaikanCAD - Project Plan & Technical Design Document

---

## 1. Introduction

**HaikanCAD** is a specialized isometric drawing tool designed for pipework planning and layout, especially for field applications such as factory installs, industrial haikan (配管), and retrofit design.  
It aims to bridge practical fieldwork and digital precision, supporting both standard and irregular piping workflows found in real-world environments.

---

## 2. Objectives

- Provide fast, intuitive pipe routing in isometric layout
- Allow “start-to-goal” or step-by-step drawing styles
- Support pipe segments with flanges, welds, sockets, reducers, and elbows
- Snap pipes correctly in 3D space even with unconventional angles
- Enable custom angle and dimension input for older or irregular systems
- Export clean documents for approval, fabrication, or CNC use
- Run on Windows, macOS, iOS, Android, and tablets

---

## 3. Platforms & Stack

| Layer        | Stack                         |
|--------------|-------------------------------|
| 💻 Desktop    | Node.js + Electron            |
| 📱 Mobile     | Capacitor.js or React Native  |
| 🧠 UI/Logic   | React.js                      |
| 📐 Drawing    | SVG (2D) ➝ Three.js (3D)      |
| 💾 Storage    | JSON / SQLite (or custom)     |
| 📤 Export     | PDF, JSON, DXF (optional)     |

---

## 4. Core Features

### 4.1 Drawing Modes

- **Mode A:** Start ➝ Goal (auto-detect needed elbows/reducers)
- **Mode B:** Step-by-step input (e.g., pipe ➝ elbow ➝ T ➝ reducer ➝ end)
- **Mode C:** Branch layout (T, Y, Cross)

### 4.2 Smart Snapping

- Snap new pipe to last segment's endpoint
- Handles vertical/horizontal orientation
- Dimension-based snapping logic with override
- Recognizes segment type (flange, socket, weld)

### 4.3 Fitting Types

- 🔩 Flanges: weld neck, socket, blind
- ➰ Elbows: 45°, 90°, short/long radius
- 🔀 T and Y branches
- 🔻 Reducers (eccentric/concentric)
- 📏 Coupling, union, socket

### 4.4 Angle Snapping

- Standard: 15°, 30°, 45°, 90°
- ✅ Custom angle support (input via number box or drag)

---

## 5. Data Model

### 5.1 Node Format

```json
{
  "id": "node001",
  "type": "flange",
  "position": [1000, 800, 1500],
  "angle": 45,
  "connection": "elbow_90",
  "metadata": {
    "size": "100A",
    "material": "SUS"
  }
}
```

### 5.2 Pipe Segment Format

```json

{
  "start": "node001",
  "end": "node002",
  "length": 300,
  "angle": 30,
  "type": "straight"
}
```
### 6. Export Plan
🖨️ Export PDF/image for printing or site approval

📐 Export DXF for CAD

💾 Save JSON or CSV for automation pipelines

🛠 Export cutting list with angles + lengths (for CNC/benders)

### 7. Roadmap
Phase	Task	Status
0	Planning + UI sketching	✅ Done
1	Basic pipe drawing engine	🔄 In progress
2	Elbows + reducers	⏳ Pending
3	Smart snapping + validation	⏳ Pending
4	3D converter	⏳ Pending
5	Export + tablet mode	⏳ Pending

### 8. Future Features
🔧 Pressure simulation (air, gas, water)

📱 Tablet/iPad touch controls

🧭 Compass and direction-aware input

📂 Load/save drawing files on mobile

🧠 AI-based layout generator (optional)

### 9. Contributors
👨‍💻 Core Developer: Shinji

🎨 UI Advisor: Naomi

🧪 QA Tester: Ryzen

📚 License: MIT (open-source)

### 10. Closing Note
HaikanCAD focuses on real-use engineering with powerful features made simple. Whether you're planning a clean new install or retrofitting an old gemba site, this tool is built to adapt.
From isometric sketching to 3D transformation, all it takes is one tap at a time.