# MaxGFA — Excel Add-in Development Plan

> Roadmap xây dựng Excel Add-in cho hệ thống tối ưu hóa GFA (Gross Floor Area).
> Mục tiêu: KTS (kiến trúc sư) có thể làm việc trực tiếp trên Excel quen thuộc,
> mọi con số/công thức nằm trong file Excel, đồng bộ 2 chiều với Web App.

---

## 1. BỐI CẢNH & MỤC TIÊU

### 1.1. Vấn đề
- KTS quen dùng Excel hơn web app
- Cần kiểm tra, chỉnh sửa trực tiếp trên bảng tính
- Cần export kết quả cho chủ đầu tư dưới dạng Excel có công thức (không phải static values)
- Cần import ngược dữ liệu Excel vào web app để chạy optimizer

### 1.2. Yêu cầu
| # | Yêu cầu | Bắt buộc |
|---|---------|----------|
| R1 | Chạy trực tiếp trên file Excel theo form mẫu | Yes |
| R2 | Các con số, công thức hoàn toàn lưu trên Excel | Yes |
| R3 | Track change, cảnh báo khi vượt mức (K, MĐXD) | Yes |
| R4 | Import ngược lại web app | Yes |
| R5 | Chạy LP Optimizer trong Excel | Phase 2 |
| R6 | Sensitivity analysis trong Excel | Phase 2 |
| R7 | Hoạt động offline | Yes |

### 1.3. Đặc điểm bài toán
- Số lô đất: 10–50 (thực tế phổ biến 10–20)
- Số mẫu tòa: 5–15 (thường < 10)
- LP problem size: rất nhỏ — 10–20 biến, 50–100 ràng buộc
- Không đòi hỏi tính toán nặng → Excel formulas + VBA dư sức xử lý

---

## 2. CHIẾN LƯỢC: 2 PHASE

### Phase 1 — Excel Template (.xlsx) — KHÔNG cần macro
> Giao ngay cho KTS dùng, mọi thứ bằng công thức Excel thuần.

### Phase 2 — Office.js Add-in (Taskpane)
> Tái sử dụng 100% engine JS từ web app, chạy LP trực tiếp trong Excel.

### Lý do chọn 2-phase:
1. Phase 1 không cần macro → không gặp security warning → dễ phân phối
2. Phase 2 tái sử dụng lpSolver.js, directCalculation.js, optimizer.js → không viết lại
3. KTS có Excel template ngay lập tức, không phải chờ add-in hoàn thiện

---

## 3. PHASE 1 — EXCEL TEMPLATE (.xlsx)

### 3.1. Cấu trúc Sheets

```
┌─────────────────────────────────────────────────┐
│ GFA_Template.xlsx                                │
├─────────────────────────────────────────────────┤
│ Sheet 1: "Dự án"       ← Thông tin dự án        │
│ Sheet 2: "Lô đất"      ← Danh sách lô + config │
│ Sheet 3: "Mẫu tòa"     ← Danh sách mẫu + KT    │
│ Sheet 4: "Phân bổ"     ← Assignment matrix       │
│ Sheet 5: "Công thức"   ← Auto-calc K, MĐXD, GFA │
│ Sheet 6: "Tổng hợp"    ← Dashboard summary       │
│ Sheet 7: "_JSON"        ← Hidden, cho import/export│
└─────────────────────────────────────────────────┘
```

### 3.2. Sheet "Dự án" — Project Info

| Ô | Nội dung | Kiểu |
|---|----------|------|
| B2 | Tên dự án | Text input |
| B3 | Tỷ lệ trừ (KT, PCCC...) | Number (0–0.3) |
| B4 | Số tầng TMDV mặc định | Integer (1–5) |
| B5 | Ngưỡng K tối ưu (%) | Number (0.85–0.95) |
| B6 | Quy định tham chiếu | Dropdown (QCVN 01:2021, CV 3633...) |

### 3.3. Sheet "Lô đất" — Lot Configuration

| Col | Header | Kiểu | Validation |
|-----|--------|------|------------|
| A | ID lô | Text | Unique, non-empty |
| B | Tên | Text | — |
| C | Diện tích (m²) | Number | > 0 |
| D | K max (hệ số SDD) | Number | > 0, ≤ 15 |
| E | MĐXD max (%) | Number | 0–100% |
| F | Số tầng max | Integer | 1–80 |

**Data Validation:**
- Column C: `=C2>0` với error message "Diện tích phải > 0"
- Column D: `=AND(D2>0, D2<=15)` với error message "K max phải từ 0 đến 15"

### 3.4. Sheet "Mẫu tòa" — Building Types

| Col | Header | Kiểu | Ý nghĩa |
|-----|--------|------|---------|
| A | ID mẫu | Text | Unique key (L_short, I1, H1...) |
| B | Tên hiển thị | Text | L ngắn, I1, H1... |
| C | Hình dạng | Dropdown | I, L, H, U, Z, SQ |
| D | DT sàn điển hình (m²) | Number | typicalArea |
| E | Tổng số tầng | Integer | totalFloors |
| F | Tầng TMDV | Integer | commercialFloors |
| G | Tầng ở | Formula | `=E2-F2` |
| H | Tổng DT sàn XD (m²) | Formula | `=D2*E2` |

**Lưu ý quan trọng:** Column D (DT sàn điển hình) là biến quyết định chính.
Khi optimizer chạy, nó thay đổi giá trị cột D → cột H tự tính lại.

### 3.5. Sheet "Phân bổ" — Assignment Matrix

Đây là bảng ma trận: hàng = lô đất, cột = mẫu tòa, giá trị = số lượng tòa.

```
         L_short  L_long  I1  I2  I3  H1  U1    TỔNG
CC01        2       0     1   0   0   0   0       3
CC02        0       1     0   2   0   0   0       3
CC03        1       0     0   0   1   1   0       3
...
```

| Ô | Công thức |
|---|-----------|
| Cột "TỔNG" | `=SUM(B2:H2)` cho mỗi hàng |
| Hàng "TỔNG" | `=SUM(B2:B15)` cho mỗi cột |
| Góc tổng | `=SUM(tất cả)` = tổng tòa nhà |

**Data Validation:** Mỗi ô chỉ nhận integer ≥ 0.

### 3.6. Sheet "Công thức" — Auto Calculation (CORE)

Đây là sheet quan trọng nhất — tính toàn bộ K, MĐXD, GFA bằng formulas.

**Cấu trúc: 1 hàng = 1 lô đất**

| Col | Header | Công thức Excel | Giải thích |
|-----|--------|-----------------|------------|
| A | ID lô | `='Lô đất'!A2` | Link |
| B | DT đất (m²) | `='Lô đất'!C2` | Link |
| C | K max | `='Lô đất'!D2` | Link |
| D | GFA max (m²) | `=B2*C2` | Trần GFA tối đa |
| E | Tổng DT sàn XD (m²) | **(xem công thức dưới)** | Tổng thực tế |
| F | K đạt | `=IF(B2>0, E2/B2, 0)` | Hệ số K thực tế |
| G | Tỷ lệ K (%) | `=IF(C2>0, F2/C2, 0)` | Utilization rate |
| H | MĐXD max (%) | `='Lô đất'!E2` | Link |
| I | MĐXD đạt (%) | **(xem công thức dưới)** | Mật độ thực tế |
| J | Số tòa | `=Phân_bổ tổng hàng` | Link |
| K | Trạng thái | **(xem công thức dưới)** | Optimal/Over/... |

**Công thức tính Tổng DT sàn XD (cột E):**

```excel
=SUMPRODUCT(
  'Phân bổ'!B2:H2,                    -- Số lượng mỗi mẫu ở lô này
  'Mẫu tòa'!$H$2:$H$8                -- Tổng DT sàn XD mỗi mẫu
)
```

Đây chính là phép tính `Σ (n_t × S_t)` cho từng lô — cùng công thức với LP solver.

**Công thức MĐXD đạt (cột I):**

```excel
=IF(B2>0,
  SUMPRODUCT(
    'Phân bổ'!B2:H2,                  -- Số lượng mỗi mẫu
    'Mẫu tòa'!$D$2:$D$8              -- DT điển hình (footprint)
  ) / B2,
  0
)
```

**Công thức trạng thái (cột K):**

```excel
=IF(OR(F2>C2, I2>H2), "VƯỢT",
  IF(G2>=0.9, "TỐI ƯU",
    IF(G2>=0.8, "KHÁ",
      IF(J2=0, "CHƯA GÁN", "THẤP")
    )
  )
)
```

### 3.7. Sheet "Tổng hợp" — Dashboard

| Chỉ tiêu | Công thức |
|-----------|-----------|
| Tổng DT đất | `=SUM('Công thức'!B:B)` |
| Tổng DT sàn XD | `=SUM('Công thức'!E:E)` |
| K trung bình | `=Tổng DT sàn / Tổng DT đất` |
| Tổng số tòa | `=SUM('Phân bổ'! tổng)` |
| Số lô tối ưu | `=COUNTIF('Công thức'!K:K, "TỐI ƯU")` |
| Số lô vượt | `=COUNTIF('Công thức'!K:K, "VƯỢT")` |
| Số lô thấp | `=COUNTIF('Công thức'!K:K, "THẤP")` |

### 3.8. Sheet "_JSON" — Import/Export Data

Sheet ẩn, chứa JSON string ở ô A1 cho web app đọc.

**Export (Excel → Web App):**
- KTS hoàn thiện bảng tính
- Copy nội dung ô `_JSON!A1` (được tạo bởi macro hoặc manual)
- Paste vào web app import dialog

**Import (Web App → Excel):**
- Web app export JSON
- Paste vào `_JSON!A1`
- Macro/manual đọc và fill vào các sheet

> Phase 1 dùng copy-paste thủ công. Phase 2 sẽ tự động hóa.

### 3.9. Conditional Formatting Rules

Áp dụng cho sheet "Công thức":

| Rule | Range | Condition | Format |
|------|-------|-----------|--------|
| Vượt K | F:F | `=F2>C2` | Red fill, white bold text |
| Vượt MĐXD | I:I | `=I2>H2` | Red fill |
| Tối ưu | K:K | `="TỐI ƯU"` | Green fill (#065f46) |
| Khá | K:K | `="KHÁ"` | Amber fill (#92400e) |
| Thấp | K:K | `="THẤP"` | Light red fill (#991b1b) |
| Vượt | K:K | `="VƯỢT"` | Red fill, bold (#dc2626) |
| Gần vượt K (>95%) | G:G | `=G2>0.95` | Orange fill (warning) |

### 3.10. Sheet Protection

| Sheet | Protected? | User có thể edit |
|-------|-----------|------------------|
| "Dự án" | Partial | B2:B6 (config values) |
| "Lô đất" | Partial | A:F (data input) |
| "Mẫu tòa" | Partial | A:F (data input, G:H are formulas) |
| "Phân bổ" | Partial | B2:H20 (counts) |
| "Công thức" | **Full lock** | Không — chỉ xem |
| "Tổng hợp" | **Full lock** | Không — chỉ xem |
| "_JSON" | Hidden | Không hiện |

### 3.11. Deliverables Phase 1

```
/excel-template/
├── GFA_Template.xlsx          ← Template rỗng, có công thức + formatting
├── GFA_DaoVuYen_Sample.xlsx   ← Template đã điền data Đảo Vũ Yên (14 lô, 7 mẫu)
└── README_Template.md         ← Hướng dẫn sử dụng cho KTS
```

---

## 4. PHASE 2 — OFFICE.JS ADD-IN (TASKPANE)

### 4.1. Tại sao Office.js?

| Tiêu chí | VBA | Office.js |
|-----------|-----|-----------|
| Reuse lpSolver.js | Phải viết lại VBA (~400 dòng) | **Import trực tiếp** |
| Reuse directCalculation.js | Phải viết lại | **Import trực tiếp** |
| Reuse optimizer.js | Phải viết lại | **Import trực tiếp** |
| Language | VBA (legacy) | **JavaScript (modern)** |
| Tooling | VBE (no git, no npm) | **VS Code, npm, git** |
| Testing | Manual | **Jest, automated** |
| Cross-platform | Windows only | **Windows + Mac + Web** |
| Security concern | Macro trust issues | **Không cần macro** |

### 4.2. Kiến trúc Add-in

```
┌─────────────────────────────────────────────────┐
│                  Excel Workbook                  │
│  ┌───────────────────────────────────────────┐   │
│  │ Sheet "Công thức" — Native Excel formulas │   │
│  └───────────────────────────────────────────┘   │
│                       ▲ ▼                        │
│              Excel.run() API                     │
│                       ▲ ▼                        │
│  ┌───────────────────────────────────────────┐   │
│  │         Office.js Taskpane (HTML/JS)      │   │
│  │                                           │   │
│  │  ┌─────────────────────────────────────┐  │   │
│  │  │  engine/ (imported from web app)    │  │   │
│  │  │  ├── lpSolver.js      ← 100% reuse │  │   │
│  │  │  ├── directCalculation.js           │  │   │
│  │  │  ├── optimizer.js                   │  │   │
│  │  │  └── reverseCalculation.js          │  │   │
│  │  └─────────────────────────────────────┘  │   │
│  │                                           │   │
│  │  ┌─────────────────────────────────────┐  │   │
│  │  │  Taskpane UI                        │  │   │
│  │  │  ├── [Tính toán] button             │  │   │
│  │  │  ├── [Tối ưu hóa LP] button        │  │   │
│  │  │  ├── [Import JSON] button           │  │   │
│  │  │  ├── [Export JSON] button           │  │   │
│  │  │  └── Status panel (KPI summary)     │  │   │
│  │  └─────────────────────────────────────┘  │   │
│  └───────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

### 4.3. Core Functions — Excel ↔ Engine Bridge

```javascript
// excel-bridge.js — Đọc data từ Excel, chuyển thành Project object

async function readProjectFromExcel() {
  return Excel.run(async (ctx) => {
    // Đọc sheet "Lô đất"
    const lotSheet = ctx.workbook.worksheets.getItem("Lô đất");
    const lotRange = lotSheet.getUsedRange();
    lotRange.load("values");

    // Đọc sheet "Mẫu tòa"
    const typeSheet = ctx.workbook.worksheets.getItem("Mẫu tòa");
    const typeRange = typeSheet.getUsedRange();
    typeRange.load("values");

    // Đọc sheet "Phân bổ"
    const assignSheet = ctx.workbook.worksheets.getItem("Phân bổ");
    const assignRange = assignSheet.getUsedRange();
    assignRange.load("values");

    await ctx.sync();

    // Transform thành Project object (cùng schema với web app)
    return {
      lots: parseLotRows(lotRange.values),
      buildingTypes: parseTypeRows(typeRange.values),
      assignments: parseAssignmentMatrix(assignRange.values),
      settings: await readSettings(ctx),
    };
  });
}

async function writeResultToExcel(result) {
  return Excel.run(async (ctx) => {
    const sheet = ctx.workbook.worksheets.getItem("Công thức");

    // Ghi formulas (không phải static values!)
    result.lotResults.forEach((lr, i) => {
      const row = i + 2; // Skip header
      // Ghi SUMPRODUCT formula cho cột E
      sheet.getRange(`E${row}`).formulas = [[
        `=SUMPRODUCT('Phân bổ'!B${row}:H${row},'Mẫu tòa'!$H$2:$H$8)`
      ]];
    });

    // Ghi optimized typicalArea vào sheet "Mẫu tòa"
    result.optimizedTypes?.forEach((bt, i) => {
      const row = i + 2;
      sheet.getRange(`D${row}`).values = [[bt.typicalArea]];
      // Cột H (totalGFA) tự tính lại vì là formula =D*E
    });

    await ctx.sync();
  });
}
```

### 4.4. Track Changes — Worksheet Event Binding

```javascript
// change-tracker.js — Theo dõi thay đổi, cảnh báo vượt mức

async function setupChangeTracking() {
  return Excel.run(async (ctx) => {
    // Listen changes trên sheet "Lô đất", "Mẫu tòa", "Phân bổ"
    const sheets = ["Lô đất", "Mẫu tòa", "Phân bổ"];

    for (const name of sheets) {
      const sheet = ctx.workbook.worksheets.getItem(name);
      sheet.onChanged.add(async (event) => {
        // Đọc lại project, tính lại, check constraints
        const project = await readProjectFromExcel();
        const result = calculateGFA(project);

        // Highlight lô vượt
        const violations = result.lotResults.filter(lr => lr.status === "over");
        if (violations.length > 0) {
          showWarning(`⚠ ${violations.length} lô vượt hệ số K!`,
            violations.map(v => `${v.lot.name}: K=${v.kAchieved.toFixed(2)} > ${v.kMax}`)
          );
        }
      });
    }

    await ctx.sync();
  });
}
```

### 4.5. JSON Import/Export

```javascript
// json-sync.js — Đồng bộ 2 chiều với Web App

async function exportToJSON() {
  const project = await readProjectFromExcel();
  const json = JSON.stringify(project, null, 2);

  // Option 1: Copy to clipboard
  await navigator.clipboard.writeText(json);

  // Option 2: Download as file
  const blob = new Blob([json], { type: "application/json" });
  saveAs(blob, `GFA_${project.name}_export.json`);

  // Option 3: Ghi vào sheet _JSON
  return Excel.run(async (ctx) => {
    const sheet = ctx.workbook.worksheets.getItem("_JSON");
    sheet.getRange("A1").values = [[json]];
    await ctx.sync();
  });
}

async function importFromJSON(jsonString) {
  const project = JSON.parse(jsonString);

  return Excel.run(async (ctx) => {
    // Ghi vào sheet "Lô đất"
    writeLotSheet(ctx, project.lots);
    // Ghi vào sheet "Mẫu tòa"
    writeTypeSheet(ctx, project.buildingTypes);
    // Ghi vào sheet "Phân bổ"
    writeAssignmentSheet(ctx, project.assignments);
    // Ghi settings
    writeSettings(ctx, project.settings);

    await ctx.sync();
  });
}
```

### 4.6. Deployment

**Recommended: Microsoft 365 Centralized Deployment**

```
1. Build add-in (npm run build)
2. Host static files (Azure Static Web Apps, hoặc internal server)
3. Upload manifest.xml lên M365 Admin Center
4. Tất cả user trong org tự động thấy add-in trong Excel ribbon
```

**Phát triển / Test:**
```bash
# Dev server (sideloading)
npx office-addin-debugging start manifest.xml
# Hoặc
npm start  # webpack-dev-server + sideload
```

### 4.7. Cấu trúc project Phase 2

```
/excel-addin/
├── manifest.xml                 ← Office.js manifest
├── package.json
├── webpack.config.js
├── src/
│   ├── taskpane/
│   │   ├── taskpane.html        ← Taskpane UI
│   │   ├── taskpane.js          ← Entry point
│   │   └── taskpane.css
│   ├── bridge/
│   │   ├── excel-bridge.js      ← Read/write Excel ↔ Project object
│   │   ├── change-tracker.js    ← Track changes, validate constraints
│   │   └── json-sync.js         ← Import/Export JSON
│   ├── engine/                  ← SYMLINK or COPY from web app
│   │   ├── lpSolver.js
│   │   ├── directCalculation.js
│   │   ├── optimizer.js
│   │   ├── reverseCalculation.js
│   │   └── explainability.js
│   └── shared/                  ← Shared types/constants
│       ├── projectSchema.js
│       └── statusConstants.js
└── tests/
    ├── bridge.test.js
    └── engine.test.js           ← Reuse web app tests
```

---

## 5. PHASE TIMELINE & MILESTONES

### Phase 1: Excel Template (1–2 tuần)

| Tuần | Task | Output |
|------|------|--------|
| W1 | Tạo template cấu trúc 7 sheets | GFA_Template.xlsx |
| W1 | Viết formulas SUMPRODUCT, K, MĐXD, status | Sheet "Công thức" hoạt động |
| W1 | Thiết lập Data Validation + Conditional Formatting | Tự động cảnh báo vượt mức |
| W1 | Điền data Đảo Vũ Yên làm sample | GFA_DaoVuYen_Sample.xlsx |
| W2 | Test với KTS: kiểm tra UX, sửa layout | Template hoàn thiện |
| W2 | Viết hướng dẫn sử dụng | README_Template.md |

**Deliverables Phase 1:**
- [x] GFA_Template.xlsx — template rỗng
- [x] GFA_DaoVuYen_Sample.xlsx — template có data mẫu
- [x] README hướng dẫn

### Phase 2: Office.js Add-in (3–4 tuần)

| Tuần | Task | Output |
|------|------|--------|
| W1 | Scaffold Office.js project + manifest | Taskpane renders trong Excel |
| W1 | Implement excel-bridge.js (đọc Excel → Project object) | Bridge layer |
| W2 | Tích hợp engine: LP + calculate + optimize | Nút "Tối ưu hóa" hoạt động |
| W2 | Ghi kết quả LP ngược vào Excel (formulas, not values) | Excel tự recalc |
| W3 | Change tracking + constraint warning | Real-time validation |
| W3 | JSON import/export (clipboard + file) | Đồng bộ web ↔ Excel |
| W4 | Test end-to-end, fix edge cases | Stable add-in |
| W4 | Deployment setup (Centralized hoặc sideload) | Distributed to team |

**Deliverables Phase 2:**
- [ ] Office.js Add-in (taskpane)
- [ ] Excel bridge layer
- [ ] JSON sync (import/export)
- [ ] Change tracking + warnings
- [ ] Deployment manifest

### Phase 3: Polish & Advanced (tùy nhu cầu)

| Feature | Mô tả |
|---------|-------|
| Scenario comparison | Lưu N bộ kết quả, so sánh side-by-side trong Excel |
| Auto-format report | Tạo sheet báo cáo đẹp cho chủ đầu tư |
| Chart generation | Tự tạo chart GFA, K, utilization |
| Version history | Track versions qua sheet _History |
| Collaborative editing | Excel Online + add-in cho teamwork |

---

## 6. MAPPING: WEB APP ↔ EXCEL TEMPLATE

### 6.1. Data Model Mapping

| Web App (project.json) | Excel Sheet | Excel Range |
|------------------------|-------------|-------------|
| `project.name` | "Dự án"!B2 | Single cell |
| `project.settings.deductionRate` | "Dự án"!B3 | Single cell |
| `project.lots[i].id` | "Lô đất"!A{i+2} | Column A |
| `project.lots[i].area` | "Lô đất"!C{i+2} | Column C |
| `project.lots[i].kMax` | "Lô đất"!D{i+2} | Column D |
| `project.buildingTypes[j].id` | "Mẫu tòa"!A{j+2} | Column A |
| `project.buildingTypes[j].typicalArea` | "Mẫu tòa"!D{j+2} | Column D |
| `project.buildingTypes[j].totalFloors` | "Mẫu tòa"!E{j+2} | Column E |
| `project.assignments[i].buildings` | "Phân bổ"!B{i+2}:H{i+2} | Matrix row |

### 6.2. Calculation Mapping

| Web App (engine) | Excel Formula |
|-----------------|---------------|
| `calculateGFA()` → `totalCountedGFA` | `=SUMPRODUCT('Phân bổ'!row, 'Mẫu tòa'!$H$)` |
| `kAchieved = totalGFA / area` | `=E2/B2` |
| `utilizationRate = kAchieved / kMax` | `=F2/C2` |
| `status = "over"/"optimal"/...` | `=IF(OR(F2>C2,...), "VƯỢT", ...)` |
| `LP objective: MAX Σ(n_t × S_t)` | **Add-in chạy lpSolver.js** |

### 6.3. Trạng thái đồng bộ

```
Web App ──export JSON──→ Excel Add-in ──importFromJSON()──→ Excel Sheets
                                                                │
                                          KTS chỉnh sửa trực tiếp
                                                                │
Web App ←──import JSON──── Excel Add-in ←──readProjectFromExcel()──┘
```

---

## 7. RỦI RO & GIẢI PHÁP

| Rủi ro | Xác suất | Giải pháp |
|--------|----------|-----------|
| KTS không quen add-in | Cao | Phase 1 chỉ dùng Excel thuần, không cần add-in |
| Office.js không hoạt động offline | Trung bình | Cache aggressive + Phase 1 backup |
| Formulas phức tạp gây nhầm lẫn | Trung bình | Lock sheet "Công thức", KTS chỉ nhập data |
| Bài toán lớn (50+ lô) chậm | Thấp | LP solver xử lý 200 lô trong < 1s |
| M365 admin không cho deploy add-in | Trung bình | Sideloading hoặc fallback Phase 1 |
| Excel version cũ (2013-) không hỗ trợ | Thấp | Office.js yêu cầu Excel 2016+; Phase 1 chạy mọi version |

---

## 8. SO SÁNH VỚI WEB APP

| Feature | Web App | Excel Template | Excel + Add-in |
|---------|---------|----------------|----------------|
| LP Optimizer | Yes | No | Yes |
| Sensitivity Analysis | Yes | No | Yes |
| Constraint Warnings | Yes | Yes (CF) | Yes (real-time) |
| Offline | No (cần host) | **Yes** | Partial |
| Edit flexibility | Medium (UI forms) | **High** (Excel) | **High** |
| Audit trail (formulas) | No (black box) | **Yes** | **Yes** |
| Import/Export | JSON | Copy-paste | **Auto** |
| Collaboration | No | SharePoint/OneDrive | SharePoint/OneDrive |
| Distribution | URL | File share | M365 Admin |

---

*Document version: 1.0 — Created: 2026-02-15*
*Liên quan: GFA_Optimizer_Concept_Document.md*
