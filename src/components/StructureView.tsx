import { buildView, fitStruct, type DrawStyle, type Struct } from '../lib/structure'

interface Props {
  struct: Struct
  mode: DrawStyle
  label: string
  width?: number
  height?: number
}

/** Công thức cấu tạo (chỉ để xem), vẽ bằng các đoạn thẳng xoay — giống bảng vẽ. */
export function StructureView({ struct, mode, label, width = 300, height = 240 }: Props) {
  const view = buildView(fitStruct(struct, width, height, 30, 54), mode)
  return (
    <div className="struct" role="img" aria-label={label} style={{ width, height }}>
      {view.bonds.map((b) => (
        <div
          key={b.id}
          aria-hidden="true"
          className="bond"
          style={{ left: b.left, top: b.top, width: b.len, transform: `rotate(${b.ang}deg)` }}
        >
          {b.lines.map((ln, i) => (
            <div key={i} className="bond-line" style={{ left: ln.l, right: ln.r, top: ln.t }} />
          ))}
        </div>
      ))}
      {view.atoms
        .filter((a) => a.vis)
        .map((a) => (
          <div key={a.id} aria-hidden="true" className="atom" style={{ left: a.x, top: a.y, color: a.color }}>
            {a.label}
          </div>
        ))}
    </div>
  )
}
