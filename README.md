# Mol → Khối lượng & Thể tích

Nhập **số mol** và **tên chất** (tiếng Việt, tiếng Anh/IUPAC, công thức hoặc số CAS) → app trả về **khối lượng**, **thể tích**, số hạt, kèm link mở chất trên PubChem, ChemSpider, NIST, CAS Common Chemistry, ChEBI, Wikipedia, Sigma-Aldrich, Fisher, TCI, Alfa Aesar, ECHA, GESTIS.

## Chạy

```bash
npm install
npm run dev      # mở http://localhost:5173
npm test         # unit test
npm run build    # bản build tĩnh trong dist/
```

Giao diện theo design MolCalc: hình công thức cấu tạo (khung/thu gọn), đơn vị mol/mmol/kmol, các bước tính, thành phần nguyên tố, bảng dữ liệu tích hợp, và **Vẽ cấu trúc** — trình vẽ [Ketcher](https://github.com/epam/ketcher) (EPAM, Apache-2.0, chạy offline bằng Indigo WASM) để tìm chất từ hình vẽ: so khớp với bảng tích hợp và tra PubChem theo SMILES. Ketcher (~8,5 MB gzip) chỉ được tải khi mở hộp thoại vẽ.

## Cách tính

- `m = n · M` — M tính từ công thức (nguyên tử khối IUPAC).
- Khí: `V = n · Vm`, Vm = 22,414 L/mol (đktc: 0 °C, 1 atm), 24,79 L/mol (đkc: 25 °C, 1 bar) hoặc `V = nRT/P` tùy chỉnh (P theo atm).
- Lỏng/rắn: `V = m / ρ`, ρ lấy từ bảng chất phổ biến (CRC) hoặc PubChem, có thể nhập tay (vd số trên trang Sigma-Aldrich).

## Nguồn dữ liệu

- `src/data/common-substances.ts` — ~170 chất phổ biến (tên VN, CAS, trạng thái, khối lượng riêng), dùng được offline.
- PubChem PUG REST — mọi chất khác; kết quả được cache trong `localStorage`.
- Các trang nhà cung cấp (Sigma-Aldrich…) chỉ được mở bằng link, app không đọc dữ liệu từ đó.
