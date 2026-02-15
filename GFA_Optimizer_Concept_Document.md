# GFA OPTIMIZER — Tối ưu Tổng Diện Tích Sàn Xây Dựng

**Phiên bản:** 2.0 (LP Solver + Phase 1 Rewrite)
**Ngày:** 15/02/2026
**Dự án:** Công cụ hỗ trợ tối ưu hóa diện tích sàn xây dựng cho các dự án bất động sản cao tầng  
**Đối tượng sử dụng:** Kiến trúc sư (KTS), Tư vấn thiết kế, Chủ đầu tư, Bộ phận phát triển dự án

---

## 1. BỐI CẢNH VÀ VẤN ĐỀ

### 1.1. Thực trạng

Trong phát triển dự án bất động sản cao tầng tại Việt Nam, việc tối ưu hóa tổng diện tích sàn xây dựng (Gross Floor Area — GFA) là bài toán then chốt quyết định hiệu quả đầu tư. Hiện tại, quá trình này chủ yếu được thực hiện thủ công bằng Excel, dẫn đến:

- Tốn nhiều thời gian lặp đi lặp lại khi thay đổi phương án
- Khó kiểm soát đồng bộ giữa nhiều lô đất khi các tòa nhà cùng mẫu phải giống nhau
- Dễ sai sót trong áp dụng quy định pháp lý (nhiều văn bản chồng chéo)
- Không có công cụ so sánh nhanh giữa các phương án

### 1.2. Mục tiêu

Xây dựng một công cụ phần mềm (web app) giúp:

1. **Tối ưu hóa** tổng diện tích sàn xây dựng cho toàn dự án, tuân thủ tất cả ràng buộc pháp lý
2. **Tự động hóa** việc tính toán hệ số sử dụng đất (K), mật độ xây dựng (MĐXD), và các chỉ tiêu liên quan
3. **Đảm bảo đồng nhất** diện tích giữa các tòa cùng mẫu nằm ở các lô đất khác nhau
4. **Module hóa** để dễ dàng mở rộng sang các phase tiếp theo (chi tiết tầng, căn hộ...)

---

## 2. MÔ HÌNH BÀI TOÁN

### 2.1. Cấu trúc phân cấp dữ liệu

```
DỰ ÁN (Project)
├── Lô đất A ─── Diện tích, K_max, MĐXD_max, Tầng cao max
│   ├── Tòa L (mẫu chung)
│   ├── Tòa L (mẫu chung)
│   └── Tòa I2 (biến thể)
├── Lô đất B
│   ├── Tòa Z (mẫu chung)
│   └── Tòa Z (mẫu chung)
├── Lô đất C
│   ├── Tòa Z × 4
│   └── ...
└── Lô đất D
    ├── Tòa L × 2
    └── Tòa Z × 2
```

### 2.2. Khái niệm cốt lõi

| Khái niệm | Định nghĩa | Vai trò trong bài toán |
|---|---|---|
| **Diện tích lô đất (S_lot)** | Diện tích đất của mỗi lô theo quy hoạch | Đầu vào cố định |
| **Hệ số sử dụng đất (K)** | Tỷ lệ tổng diện tích sàn (trừ phần được miễn) / diện tích lô đất | Ràng buộc chính, K ≤ K_max |
| **Mật độ xây dựng (MĐXD)** | Tỷ lệ diện tích chiếm đất công trình / diện tích lô đất | Ràng buộc phụ, MĐXD ≤ MĐXD_max |
| **Diện tích sàn điển hình (f_t)** | Diện tích 1 tầng điển hình của mẫu tòa t | **Biến quyết định chính** |
| **Mẫu tòa (Building Type)** | Shape (I, L, H, U, Z, Square) + diện tích điển hình | Đầu vào có thể điều chỉnh |
| **Biến thể (Variant)** | Phiên bản khác nhẹ của cùng 1 mẫu (VD: I1, I2) | Mở rộng tính linh hoạt |

### 2.3. Bản chất toán học

Đây là bài toán **tối ưu có ràng buộc với biến chia sẻ** (Constrained Optimization with Shared Variables):

**Hàm mục tiêu:**

```
MAXIMIZE  Σ_j Σ_{t ∈ T_j} f_t × n_t
```

Trong đó:
- `j` = index lô đất
- `T_j` = tập các tòa trong lô j
- `f_t` = diện tích sàn điển hình của mẫu t (**biến chia sẻ giữa các lô**)
- `n_t` = số tầng tính hệ số SDD

**Ràng buộc:**

| # | Ràng buộc | Công thức |
|---|---|---|
| C1 | Hệ số SDD mỗi lô | Σ(f_t × n_t) / S_j ≤ K_max_j |
| C2 | Mật độ xây dựng | Σ(footprint_t) / S_j ≤ MĐXD_max_j |
| C3 | Hệ số SDD tổng hợp đế+tháp | ≤ 13 lần (QCVN 01:2021) |
| C4 | Diện tích điển hình hợp lý | f_t ∈ [f_min, f_max] |
| C5 | Đồng nhất mẫu tòa | f_t giống nhau cho mọi tòa cùng mẫu |

**Điểm đặc biệt:** Ràng buộc C5 tạo ra **coupling** (liên kết) giữa các lô đất. Nếu tăng f_t để tối ưu cho lô A, tòa cùng mẫu ở lô B cũng tăng theo → có thể vi phạm K_max của lô B. Đây chính là lý do bài toán không thể giải đơn giản bằng cách tối ưu từng lô riêng rẻ.

### 2.4. Phân loại bài toán

- **Loại (Phase 1):** Linear Programming thuần túy — biến liên tục S_t, ràng buộc tuyến tính
- **Loại (Phase 2+):** Mixed-variable Optimization (biến liên tục S_t + biến rời rạc n_tầng) → NP-hard tổng quát, nhưng tractable với quy mô thực tế (5-20 lô, 3-10 mẫu)
- **Phương pháp đã implement:** Two-Phase Simplex Method (LP) cho Phase 1, Monte Carlo fallback
- **Phương pháp tương lai:** GA cho Phase 2+, LLM-assisted cho config và pháp lý

---

## 3. THUẬT TOÁN

### 3.1. Tổng quan Flow

```
[INPUT: Project Config]
        │
        ▼
[Phase A] ── Tính toán trực tiếp (Direct Calculation)
        │    Với S_t hiện tại → tính GFA, K, MĐXD mỗi lô
        │    KHÔNG auto-scale — chỉ tính và báo cáo
        │
        ▼
[Phase B] ── Tối ưu hóa LP (Linear Programming)
        │    Giải chính xác bằng Simplex Method
        │    Tìm S_t tối ưu cho từng mẫu tòa
        │    + Monte Carlo fallback cho bài toán phi tuyến
        │
        ▼
[Phase C] ── Tinh chỉnh (Refinement)  ← KTS thực hiện
        │    Output: dải [S_min, S_max] cho mỗi mẫu (sensitivity)
        │    KTS cân chỉnh tay trong dải này
        │
        ▼
[OUTPUT: Kết quả tối ưu + Sensitivity Analysis + Báo cáo]
```

### 3.2. Phase A — Tính toán trực tiếp (Direct Calculation)

Đây là engine tính toán cơ bản, chạy mỗi khi user thay đổi config.

**INVARIANT:** Cùng mẫu tòa (building type) = cùng S_t (tổng DT sàn XD) ở MỌI lô.

**Nguyên tắc v2.0:** Engine chỉ TÍNH, không SCALE. Nếu config hiện tại vi phạm ràng buộc → báo trạng thái "over", không tự động điều chỉnh. Muốn tìm giá trị tối ưu → gọi Optimizer (Phase B).

**Thuật toán:**

```
INPUT: lots[], buildingTypes[], assignments[], settings{}

──────────────────────────────────────────────────
Biến quyết định Phase 1:
  S_t = tổng DT sàn XD của 1 tòa mẫu t
      = typicalArea × totalFloors (nếu chưa set totalGFA)
──────────────────────────────────────────────────

FOR mỗi lô j:
  FOR mỗi tòa trong lô:
     totalGFA = bt.totalGFA || bt.typicalArea × bt.totalFloors
     countedGFA = totalGFA × (1 - deductionRate)   // Phase 1: deductionRate = 0

  // Tính chỉ số lô
  kAchieved = Σ(countedGFA) / lot.area
  densityAchieved = Σ(typicalArea) / lot.area
  utilizationRate = kAchieved / kMax

  // Xác định trạng thái
  status = "over"    nếu kAchieved > kMax hoặc density > densityMax
         = "optimal" nếu utilizationRate ≥ kTargetMin (90%)
         = "good"    nếu utilizationRate ≥ 80%
         = "low"     nếu utilizationRate < 80%

OUTPUT: lotResults[], typeAggregation{}, projectTotal{}
```

**Tại sao bỏ Global Scaling?**

Phiên bản 1.x dùng Global Scale Factor — 1 hệ số duy nhất scale tất cả mẫu tòa đồng đều. Vấn đề: lô chặt nhất quyết định scale factor cho TOÀN BỘ dự án, dẫn đến các lô khác bị "kéo xuống" không cần thiết.

Phiên bản 2.0 tách biệt: calculation engine chỉ TÍNH, LP optimizer tìm S_t tối ưu RIÊNG cho từng mẫu tòa (vẫn đảm bảo cùng mẫu = cùng giá trị). Hiệu quả hơn đáng kể vì mỗi mẫu tòa có thể được tối ưu độc lập trong biên ràng buộc.

### 3.3. Phase B — Tối ưu hóa LP (Linear Programming)

**Nhận thức cốt lõi:** Bài toán Phase 1 là **LP thuần túy** (Linear Programming). Cả hàm mục tiêu lẫn ràng buộc đều tuyến tính theo biến S_t.

**Phương pháp chính: Two-Phase Simplex Method (chính xác, không random)**

```
INPUT: lots[], buildingTypes[], assignments[], bounds{}

──────────────────────────────────────────────────
Xây dựng bài toán LP chuẩn:
──────────────────────────────────────────────────

Biến:     x_t = S_t (tổng DT sàn XD của mẫu t), t = 1..T
          T = số mẫu tòa (VD: 7 mẫu → 7 biến)

Mục tiêu: MAX  Σ_t (N_t × x_t)
          trong đó N_t = tổng số tòa mẫu t trên toàn dự án

Ràng buộc (m lô):
  Σ_t (n_tj × x_t) ≤ area_j × kMax_j     ∀ lô j = 1..m
  trong đó n_tj = số tòa mẫu t trong lô j

Biên:     lb_t ≤ x_t ≤ ub_t
          (default: ±50% giá trị hiện tại)

──────────────────────────────────────────────────
Giải bằng Simplex:
──────────────────────────────────────────────────

1. Chuyển về dạng chuẩn (variable substitution cho lower bounds)
2. Phase I Simplex: tìm BFS khả thi (basic feasible solution)
3. Phase II Simplex: tối ưu hàm mục tiêu từ BFS
4. Trích nghiệm: x_t* = S_t tối ưu cho từng mẫu
5. Sensitivity analysis: tính [S_min, S_max] khả thi cho mỗi mẫu

OUTPUT:
  - solution{}: S_t tối ưu cho từng mẫu
  - bindingLots[]: các lô đạt kMax (bottleneck)
  - sensitivity{}: dải khả thi [min, max] cho mỗi mẫu
  - improvement: % cải thiện so với baseline
```

**Ưu điểm LP so với Monte Carlo:**
- **Chính xác:** Nghiệm tối ưu toàn cục, không phụ thuộc random
- **Nhanh:** Single-pass, O(m²×T) thay vì O(iterations × m × T)
- **Sensitivity:** Tự động tính dải khả thi cho KTS điều chỉnh
- **Binding analysis:** Xác định lô nào là bottleneck → CĐT biết nên đàm phán tăng kMax ở đâu

**Kết quả validate với dự án Đảo Vũ Yên:**
- Giá trị Excel hiện tại gần tối ưu (chỉ cách LP optimum ~0.05%)
- Binding lots: CC06 (lô chặt nhất, kMax = 7.62)
- Nếu tăng kMax CC06 từ 7.62 → 8.5: tổng GFA tăng +1.60%

### 3.4. Phương pháp bổ sung

**Monte Carlo (fallback):** Giữ lại cho bài toán phi tuyến hoặc khi LP không áp dụng được.

```
bestResult = null
bestTotalGFA = 0

FOR i = 1 TO iterations:
  1. Perturbation: S_t_trial = S_t × (1 ± perturbRange)
  2. Chạy Direct Calculation với S_t_trial
  3. NẾU tất cả lô status ≠ "over" VÀ totalGFA > bestTotalGFA:
     → Cập nhật best

RETURN bestResult
```

**Combined Optimization:** LP → Monte Carlo refinement → chọn kết quả tốt nhất.

**Kế hoạch nâng cao (Phase 2+):**
- Genetic Algorithm (GA) cho bài toán mixed-integer (khi số tầng cũng là biến)
- LLM-assisted: AI phân tích văn bản pháp lý → suggest deduction rules
- LLM gợi ý phạm vi S_t hợp lý dựa trên kinh nghiệm thiết kế

---

## 4. QUY ĐỊNH PHÁP LÝ ĐÃ TÍCH HỢP

### 4.1. Danh sách văn bản tham chiếu

| # | Văn bản | Nội dung chính | Ngày |
|---|---|---|---|
| 1 | QCVN 01:2021/BXD | Quy chuẩn quốc gia về Quy hoạch xây dựng | 2021 |
| 2 | CV 3633/BXD-KHCN | Hướng dẫn áp dụng QCVN 01:2021 (trả lời Taseco Invest) | 08/2023 |
| 3 | CV 1637/BXD-KHCN | Hướng dẫn xác định diện tích sàn khi tính hệ số SDD | 05/2022 |
| 4 | Biên bản Cục QLHĐXD | Thống nhất nội dung từ buổi sinh hoạt chuyên đề (lần 1) | 05/2024 |
| 5 | Thông tư 06/2021/TT-BXD | Quy định phân loại và cách tính diện tích sàn | 06/2021 |

### 4.2. Quy tắc tính hệ số sử dụng đất (K)

**Công thức gốc (Mục 1.4.21 QCVN 01:2021):**

```
K = Tổng DT sàn (trừ phần miễn) / Tổng DT lô đất
```

**Phần diện tích được trừ (không tính vào hệ số K):**

1. Tầng hầm chỉ bố trí đỗ xe + kỹ thuật + PCCC + lánh nạn → **toàn bộ không tính**
2. Tầng hỗn hợp (đỗ xe + thương mại) → **chỉ trừ phần đỗ xe/kỹ thuật/lánh nạn**, phần còn lại tính
3. Giếng thang máy ở tầng không dừng → **không tính** (theo CV 3633)
4. Mái không kinh doanh → **không tính** (trừ bể bơi kinh doanh trên mái → tính)
5. Diện tích sàn kỹ thuật, phòng PCCC, gian lánh nạn → **không tính**
6. Không gian trống (không tường bao, không công năng sử dụng) → **không tính** (theo BB Cục QLHĐXD)

**Lưu ý quan trọng:** Phần chiếm diện tích cột/vách/tường bao thuộc hệ giao thông chung (trừ thang thoát hiểm và thang chữa cháy) → **KHÔNG được trừ** khi tính hệ số SDD.

### 4.3. Quy tắc mật độ xây dựng (MĐXD)

**Mục 1.4.20 QCVN 01:2021:**

```
MĐXD = Diện tích chiếm đất công trình / Diện tích lô đất
```

Diện tích chiếm đất = hình chiếu bằng mái của công trình (không bao gồm ban-công phải tuân thủ khoảng lùi, mái đua/mái đón không bố trí công năng sử dụng).

**Với tổ hợp đế + tháp (Mục 2.6.3):**
- MĐXD tính **riêng** cho phần đế và phần tháp
- Theo chiều cao xây dựng tương ứng
- Đảm bảo hệ số SDD chung đế + tháp ≤ 13 lần

### 4.4. Nguyên tắc áp dụng

> **Khi có 2 quy định chồng chéo về cùng 1 vấn đề, quy định có lợi hơn cho chủ đầu tư sẽ được áp dụng.**

Ví dụ: Nếu một văn bản cho phép hệ số cao hơn, văn bản đó sẽ được ưu tiên. Engine cần encode logic so sánh này.

---

## 5. KIẾN TRÚC PHẦN MỀM

### 5.1. Technology Stack

| Layer | Công nghệ | Lý do |
|---|---|---|
| Frontend | React (JSX) + Tailwind-style CSS | Tương tác tốt, dễ module hóa |
| State Management | React hooks (useState, useCallback, useMemo) | Đủ cho quy mô hiện tại |
| Optimization Engine | JavaScript (client-side) | Nhanh, không cần server cho Phase 1 |
| Export | xlsx library (SheetJS) | Export Excel quen thuộc với KTS |
| Future: Backend | Node.js / Python (FastAPI) | Khi cần solver mạnh hơn (LP, GA) |
| Future: AI | Anthropic API (Claude) | Config assistant, legal analysis |

### 5.2. Module Architecture

```
┌──────────────────────────────────────────────────┐
│                   GFA OPTIMIZER v2.0               │
├──────────────┬──────────────┬─────────────────────┤
│  UI Layer    │  Engine      │  Data / IO          │
│              │              │                     │
│ Dashboard    │ DirectCalc   │ ProjectStore        │
│ ConfigPanel  │ LP Solver    │ LegalRulesDB        │
│ TypeEditor   │ Optimizer    │ ExcelExporter        │
│ LegalViewer  │  (LP+MC)    │ ProjectImporter     │
│ Comparison   │ Sensitivity  │ TemplateManager     │
│ (future)     │ Explainer    │                     │
│              │ ReverseCalc  │                     │
└──────────────┴──────────────┴─────────────────────┘
```

### 5.3. Data Flow

```
[User Config] → [ProjectStore] → [OptimizationEngine] → [Results]
                      ↑                                      │
                      │                                      ▼
              [Legal Rules DB]                      [UI Dashboard]
                                                    [Excel Export]
                                                    [Comparison]
```

---

## 6. LỘ TRÌNH PHÁT TRIỂN (ROADMAP)

### Phase 1 — Tổng Diện Tích Sàn (HIỆN TẠI)

**Mục tiêu:** Tối ưu tổng GFA cho toàn dự án, output = tổng diện tích sàn mỗi mẫu tòa.

| Feature | Trạng thái | Mô tả |
|---|---|---|
| Config lô đất | ✅ Done | Diện tích, K_max, MĐXD_max, tầng cao |
| Config mẫu tòa | ✅ Done | Shape, diện tích điển hình, biến thể |
| Phân bổ tòa → lô | ✅ Done | Gán mẫu tòa vào từng lô |
| Direct Calculation | ✅ Done | Tính GFA, K, MĐXD tức thì (v2.0: không auto-scale) |
| LP Optimizer | ✅ Done | Simplex Method — nghiệm chính xác, sensitivity analysis |
| Monte Carlo Fallback | ✅ Done | 800 iterations perturbation (backup cho bài toán phi tuyến) |
| Dashboard | ✅ Done | KPI, lot cards, type summary |
| Legal Rules Reference | ✅ Done | 4 văn bản chính |
| Excel Export | 🔲 Todo | Export kết quả ra .xlsx |
| Scenario Comparison | 🔲 Todo | So sánh nhiều phương án |
| Add/Remove lots dynamically | 🔲 Todo | Thêm/xóa lô đất từ UI |
| Add/Remove building types | 🔲 Todo | Thêm/xóa mẫu tòa từ UI |
| Save/Load project | 🔲 Todo | Lưu/tải config dự án (JSON) |

### Phase 1.5 — Hoàn thiện và Validation

**Mục tiêu:** Kiểm chứng kết quả với dự án thực, hoàn thiện UX.

| Feature | Mô tả |
|---|---|
| Import từ Excel | Đọc file Excel hiện có (format dự án Vũ Yên) → auto-populate config |
| Validation engine | So sánh kết quả phần mềm vs tính toán Excel thực tế → báo chênh lệch |
| Sensitivity analysis | Thay đổi 1 tham số → xem ảnh hưởng đến toàn bộ dự án |
| Podium/Tower separation | Tính MĐXD riêng cho khối đế và khối tháp |
| Deduction calculator | Config chi tiết diện tích trừ (hầm, kỹ thuật, PCCC...) thay vì tỷ lệ chung |
| Multi-scenario comparison | Lưu và so sánh N phương án cạnh nhau |
| PDF report | Xuất báo cáo chuyên nghiệp |

### Phase 2 — Chi Tiết Tầng

**Mục tiêu:** Từ tổng GFA đã tối ưu → phân bổ chi tiết cho từng tầng.

| Feature | Mô tả |
|---|---|
| Floor breakdown | Chia tổng GFA thành: tầng đế, tầng điển hình, tầng kỹ thuật, tum/mái |
| Podium detail | Config khối đế: TMDV, lobby, kỹ thuật, đỗ xe... |
| Tower detail | Config khối tháp: tầng căn hộ, tầng giật cấp, sky lobby |
| Floor area variation | Cho phép diện tích khác nhau theo tầng (giật cấp, setback) |
| Vertical zoning | Phân vùng theo chiều cao (zone dưới, giữa, cao) |

### Phase 3 — Chi Tiết Căn Hộ

**Mục tiêu:** Từ diện tích mỗi tầng → chia thành các căn hộ.

| Feature | Mô tả |
|---|---|
| Unit mix optimization | Tối ưu tổ hợp căn hộ (studio, 1BR, 2BR, 3BR) |
| Area per unit | Diện tích thông thủy, tim tường, diện tích sử dụng |
| Common area calculation | Hành lang, sảnh, kỹ thuật tầng |
| Efficiency ratio | Tỷ lệ diện tích sử dụng / tổng diện tích sàn |
| Revenue optimization | Tối ưu theo giá bán dự kiến (nếu có dữ liệu) |

### Phase 4 — AI-Assisted và Nâng Cao

| Feature | Mô tả |
|---|---|
| LLM Config Assistant | Chat với AI để setup dự án từ mô tả text |
| Legal AI Analyzer | AI đọc văn bản pháp lý → suggest rules tự động |
| Auto-layout suggestion | AI gợi ý bố trí tòa trong lô dựa trên hình dạng đất |
| Market data integration | Kết nối dữ liệu thị trường → tối ưu theo doanh thu |
| 3D visualization | Hiển thị 3D concept massing |

---

## 7. CÁC LƯU Ý QUAN TRỌNG

### 7.1. Về tính toán

1. **Coupling giữa các lô:** Đây là core difficulty. Không thể tối ưu từng lô riêng rồi ghép lại. Phải tối ưu đồng thời vì các tòa cùng mẫu ở các lô khác nhau phải có cùng diện tích. LP solver xử lý chính xác điều này.

2. **LP thay vì Global Scaling:** Phiên bản 2.0 dùng LP Simplex thay cho Global Scale Factor. LP tìm S_t tối ưu **riêng cho từng mẫu tòa** (nhưng vẫn đảm bảo cùng mẫu = cùng giá trị ở mọi lô). Hiệu quả hơn đáng kể so với 1 hệ số scale đồng đều. Direct Calculation chỉ TÍNH, không SCALE — tách biệt rõ ràng giữa tính toán và tối ưu.

3. **Hệ số K không phải mục tiêu tuyệt đối:** Mục tiêu là **maximize tổng GFA**, K chỉ là ràng buộc. Có thể 1 lô đạt 95% K_max nhưng lô khác đạt 100% → tổng vẫn tốt hơn so với mọi lô đều 97%.

4. **Sensitivity Analysis:** LP solver tự động tính dải `[S_min, S_max]` cho mỗi mẫu tòa. KTS có thể cân chỉnh trong dải này mà vẫn đảm bảo feasible. Binding lots (lô đạt kMax) được highlight rõ → CĐT biết nên đàm phán ở đâu.

5. **Deduction rate:** Tỷ lệ trừ (kỹ thuật, PCCC, tum...) khác nhau giữa các dự án. Phase 1 dùng deductionRate = 0 (tối ưu tổng DT sàn XD trực tiếp), Phase 2 sẽ xử lý chi tiết.

### 7.2. Về pháp lý

1. **Nguyên tắc có lợi cho CĐT:** Khi 2 quy định cho kết quả khác nhau về cùng 1 chỉ tiêu, quy định cho phép giá trị cao hơn (có lợi cho CĐT) sẽ được áp dụng. Engine cần encode logic `max()` này.

2. **Tầng hầm:** Tầng hầm CHỈ bố trí đỗ xe + kỹ thuật + PCCC + lánh nạn → TOÀN BỘ không tính K. Nhưng tầng hầm có xen thương mại → chỉ trừ phần đỗ xe/kỹ thuật.

3. **Giếng thang máy tầng không dừng:** Đây là điểm hay bị tranh luận. Theo CV 3633: nếu thang máy không mở cửa ở tầng đó → giếng thang máy tầng đó không tính vào diện tích sàn xây dựng, do đó không tính hệ số SDD.

4. **Tổ hợp đế + tháp:** MĐXD tính RIÊNG cho khối đế và khối tháp, nhưng K tổng hợp ≤ 13 lần. Cần rõ ranh giới đế/tháp.

5. **Cập nhật liên tục:** Văn bản pháp lý thường xuyên bổ sung. Hệ thống cần cơ chế cập nhật rules database dễ dàng (không hardcode).

### 7.3. Về kỹ thuật phần mềm

1. **Client-side trước:** Phase 1-2 chạy hoàn toàn trên trình duyệt, không cần server. Đơn giản, dễ deploy, bảo mật dữ liệu.

2. **Module hóa:** Mỗi module (Optimizer, LegalRules, Exporter...) nên independent, dễ thay thế hoặc nâng cấp riêng.

3. **Undo/Redo:** Cần thiết cho UX. User thường thử nhiều config rồi quay lại.

4. **Auto-save:** Tránh mất dữ liệu khi đóng trình duyệt. Dùng localStorage hoặc IndexedDB.

5. **Performance:** LP Simplex giải trong < 1ms cho 14 lô × 7 mẫu. Monte Carlo fallback (800 iterations) cần < 1 giây. JavaScript client-side đủ nhanh cho Phase 1-2.

### 7.4. Về thực tế sử dụng

1. **KTS vẫn là người quyết định cuối:** Phần mềm cho output tham khảo, KTS cân nhắc thêm yếu tố thiết kế, thẩm mỹ, kỹ thuật kết cấu mà phần mềm chưa cover.

2. **Số liệu từ bản vẽ CAD:** Diện tích thực tế từ bản vẽ AutoCAD có thể chênh lệch nhỏ so với tính toán. Phase 1.5 nên có chức năng so sánh và cân chỉnh.

3. **Quy trình làm việc đề xuất:**
   - Bước 1: CĐT cung cấp quy hoạch chi tiết → nhập vào hệ thống
   - Bước 2: KTS đề xuất bố trí sơ bộ (mẫu tòa, số tòa mỗi lô)
   - Bước 3: Chạy optimizer → lấy diện tích điển hình tối ưu
   - Bước 4: KTS thiết kế chi tiết trong phạm vi diện tích đề xuất
   - Bước 5: Import số liệu CAD → validate lại

---

## 8. DỮ LIỆU MẪU (Tham khảo từ Dự án Đảo Vũ Yên)

### 8.1. Các mẫu tòa trong dự án thực tế

| Mẫu | Số lượng | DT điển hình (m²) | Số tầng | Ghi chú |
|---|---|---|---|---|
| Tòa L ngắn | 6 | 1.472,67 | 30 | Shape L, cạnh ngắn |
| Tòa L dài | 2 | 1.778,53 | 30 | Shape L, cạnh dài |
| Tòa Z | 11 | 1.472,67 | 30 | Shape Z |
| Tòa I1 | 2 | 1.472,67 | 30 | Shape I, biến thể 1 |
| Tòa I2 | 3 | 1.685,84 | 30 | Shape I, biến thể 2 |
| Tòa I3 | 6 | 1.620,00 | 8 | Shape I, thấp tầng (NOXH) |
| Tòa Vuông | 2 | 1.188,16 | 30 | Shape Square |
| **Tổng** | **32** | | | |

### 8.2. Tổng hợp dự án

| Chỉ tiêu | Giá trị |
|---|---|
| Tổng diện tích đất | 516.014 m² |
| Tổng diện tích sàn tính hệ số SDD | 1.229.290 m² |
| Số tòa | 32 |
| Số mẫu tòa | 7 |
| Số lô đất chính (CC) | 14 |

---

## 9. GLOSSARY (Thuật ngữ)

| Viết tắt | Tiếng Việt | English |
|---|---|---|
| GFA | Tổng diện tích sàn | Gross Floor Area |
| K / SDD | Hệ số sử dụng đất | Floor Area Ratio (FAR) |
| MĐXD | Mật độ xây dựng | Building Coverage Ratio (BCR) |
| CĐT | Chủ đầu tư | Developer / Investor |
| KTS | Kiến trúc sư | Architect |
| TMDV | Thương mại dịch vụ | Commercial services |
| PCCC | Phòng cháy chữa cháy | Fire protection |
| NOXH | Nhà ở xã hội | Social housing |
| DT | Diện tích | Area |
| QCVN | Quy chuẩn Việt Nam | Vietnam National Technical Regulation |
| BXD | Bộ Xây dựng | Ministry of Construction |

---

## 10. NEXT STEPS NGAY LẬP TỨC

1. **Kết nối UI với LP Optimizer** → gọi `runLPOptimization()` từ Dashboard, hiển thị sensitivity
2. **Bổ sung Excel export** → KTS có thể download kết quả và kiểm tra bằng tool quen thuộc
3. **Thêm dynamic add/remove** lô đất và mẫu tòa từ UI
4. **Save/Load project** để không mất config khi reload
5. **Binding lot visualization** → highlight lô bottleneck trên Dashboard
6. **Phase 2 prep** → thêm floor breakdown (tầng đế/tầng điển hình/kỹ thuật/tum)

---

*Tài liệu này sẽ được cập nhật liên tục theo tiến độ phát triển.*
