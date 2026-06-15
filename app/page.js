"use client";
import { useState, useMemo } from "react";

const SUPPLIERS = ["vane", "Joyce", "貞", "鼎程", "海渡", "日本批發", "好兒", "momo"];
const INITIAL_CUSTOMERS = [
  "Irene", "a-lun lun", "Anny Lee", "Fen", "Hsiao", "Huang", "LiLy", "Lin Lin", "SNOW"
];
const MONTHS = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwifJblwus8Fhpt81FNfS7G6zF52dPXLynDWEMDjGu-ybKOxW6EyPlAnMSq5tjeB89foQ/exec";

const nowMonth = () => new Date().getMonth() + 1;
const nowDate = () => { const d = new Date(); return `${d.getMonth()+1}/${d.getDate()}`; };

const emptyForm = {
  customer: "", product: "", style: "", price: "", cost: "", qty: "1",
  supplier: "", weight: "", note: "", date: nowDate(), month: nowMonth(),
};

const waitingLabel = (orderMonth) => {
  const diff = nowMonth() - Number(orderMonth);
  if (diff <= 0) return null;
  return diff === 1 ? "等了1個月" : `等了${diff}個月`;
};

const monthColor = (m) => {
  const colors = ["#c0392b","#e67e22","#d4ac0d","#27ae60","#16a085","#2980b9","#8e44ad","#c0392b","#d35400","#27ae60","#2c3e50","#7f8c8d"];
  return colors[(Number(m) - 1) % 12];
};

export default function App() {
  const [tab, setTab] = useState("add");
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [customers, setCustomers] = useState(INITIAL_CUSTOMERS);
  const [newCustomer, setNewCustomer] = useState("");
  const [filterCustomer, setFilterCustomer] = useState("全部");
  const [filterStatus, setFilterStatus] = useState("全部");
  const [filterMonth, setFilterMonth] = useState("全部");
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  const handleChange = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const loadFromSheet = async () => {
    setLoading(true);
    setSaveMsg("");
    try {
      const res = await fetch(SCRIPT_URL, { method: "GET", mode: "cors" });
      const json = await res.json();
      if (json.result === "success" && json.data) {
        const loaded = json.data.map((o, i) => {
          const m = o.sheetMonth ? parseInt(String(o.sheetMonth).replace("月","")) : nowMonth();
          return {
            ...o,
            id: Date.now() + i,
            month: m,
            date: o.date ? `${m}/${o.date}` : "",
            ordered: true,
            arrived: o.arrived || false,
            picked: o.picked || false,
            qty: o.qty || 1,
            price: o.price || "",
            cost: o.cost || "",
          };
        });
        setOrders(loaded);
        // Add any new customers
        const newCustomers = [...new Set(loaded.map(o => o.customer).filter(Boolean))];
        setCustomers(prev => [...new Set([...prev, ...newCustomers])]);
        setSaveMsg(`✅ 已載入 ${loaded.length} 筆訂單`);
        setTab("overview");
      } else {
        setSaveMsg("⚠️ 載入失敗，請再試一次");
      }
    } catch (err) {
      setSaveMsg("⚠️ 載入失敗：" + err.message);
    }
    setLoading(false);
    setTimeout(() => setSaveMsg(""), 4000);
  };

  const saveToSheet = async (orderData) => {
    try {
      await fetch(SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData)
      });
      return true;
    } catch (err) {
      return false;
    }
  };

  const handleSubmit = async () => {
    if (!form.customer || !form.product || !form.price) {
      alert("請填寫客人、商品名稱、單價");
      return;
    }
    setSaving(true);
    setSaveMsg("");
    const orderData = { ...form, ordered: false, arrived: false, picked: false };
    if (editId !== null) {
      setOrders(os => os.map(o => o.id === editId
        ? { ...form, id: editId, ordered: o.ordered, arrived: o.arrived, picked: o.picked }
        : o));
      setEditId(null);
    } else {
      setOrders(os => [...os, { ...orderData, id: Date.now() }]);
      const ok = await saveToSheet(orderData);
      setSaveMsg(ok ? "✅ 已儲存到 Google 試算表" : "⚠️ 本地已儲存，試算表同步失敗");
      setTimeout(() => setSaveMsg(""), 3000);
    }
    setForm(emptyForm);
    setSaving(false);
    setTab("overview");
  };

  const updateStatusInSheet = async (rowId, field, value) => {
    try {
      await fetch(SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updateStatus", rowId, field, value })
      });
    } catch (err) {}
  };

  const toggleStatus = (id, field) => {
    setOrders(os => os.map(o => {
      if (o.id !== id) return o;
      const newVal = !o[field];
      if (o.rowId && (field === "arrived" || field === "picked")) {
        updateStatusInSheet(o.rowId, field, newVal);
      }
      return { ...o, [field]: newVal };
    }));
  };
  const deleteOrder = (id) => { if (confirm("確定刪除這筆訂單？")) setOrders(os => os.filter(o => o.id !== id)); };
  const startEdit = (order) => { setForm({ ...order }); setEditId(order.id); setTab("add"); };
  const addCustomer = () => {
    const name = newCustomer.trim();
    if (name && !customers.includes(name)) { setCustomers(c => [...c, name]); setNewCustomer(""); }
  };

  const usedMonths = useMemo(() => {
    const s = new Set(orders.map(o => Number(o.month)));
    return Array.from(s).sort((a, b) => a - b);
  }, [orders]);

  const filtered = useMemo(() => orders.filter(o => {
    const cMatch = filterCustomer === "全部" || o.customer === filterCustomer;
    const mMatch = filterMonth === "全部" || Number(o.month) === Number(filterMonth);
    const sMatch =
      filterStatus === "全部" ? true :
      filterStatus === "未訂貨" ? !o.ordered :
      filterStatus === "未到貨" ? o.ordered && !o.arrived :
      filterStatus === "未取貨" ? o.arrived && !o.picked :
      filterStatus === "已完成" ? o.arrived && o.picked : true;
    return cMatch && mMatch && sMatch;
  }), [orders, filterCustomer, filterMonth, filterStatus]);

  const arrivedGrouped = useMemo(() => {
    const arrivedOrders = orders.filter(o => o.arrived && !o.picked);
    const map = {};
    arrivedOrders.forEach(o => { if (!map[o.customer]) map[o.customer] = []; map[o.customer].push(o); });
    return map;
  }, [orders]);
    const map = {};
    filtered.forEach(o => { if (!map[o.customer]) map[o.customer] = []; map[o.customer].push(o); });
    return map;
  }, [filtered]);

  const safeNum = (v) => { const n = Number(v); return isNaN(n) ? 0 : n; };
  const totalQty = filtered.reduce((s, o) => s + safeNum(o.qty), 0);
  const totalAmount = filtered.reduce((s, o) => s + safeNum(o.price) * safeNum(o.qty), 0);

  return (
    <div style={{ fontFamily: "'Noto Sans TC', sans-serif", background: "#f5f0eb", minHeight: "100vh", color: "#2d2318" }}>
      {/* Header */}
      <div style={{ background: "#2d2318", color: "#f5f0eb", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: 3, opacity: 0.6, marginBottom: 2 }}>代購管理系統</div>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: 1 }}>訂單管理</div>
        </div>
        {/* Load button */}
        <button onClick={loadFromSheet} disabled={loading} style={{
          background: loading ? "#888" : "#4a7c59", color: "#fff", border: "none",
          borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer"
        }}>{loading ? "載入中..." : "☁️ 從試算表載入"}</button>
      </div>

      {/* Save/load message */}
      {saveMsg && (
        <div style={{ background: saveMsg.includes("✅") ? "#eaf6ee" : "#fff3cd", color: saveMsg.includes("✅") ? "#2d5c3a" : "#856404", padding: "10px 20px", fontSize: 13, textAlign: "center", fontWeight: 600 }}>
          {saveMsg}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", background: "#e8e0d5", borderBottom: "2px solid #2d2318" }}>
        {[["add", "＋ 新增訂單"], ["overview", "📋 訂單總覽"], ["arrived", "📦 到貨清單"]].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            flex: 1, padding: "12px", border: "none", cursor: "pointer",
            background: tab === key ? "#2d2318" : "transparent",
            color: tab === key ? "#f5f0eb" : "#2d2318",
            fontWeight: tab === key ? 700 : 400, fontSize: 14, letterSpacing: 1, transition: "all 0.2s"
          }}>{label}</button>
        ))}
      </div>

      {/* Add Order Tab */}
      {tab === "add" && (
        <div style={{ padding: 20, maxWidth: 600, margin: "0 auto" }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 2px 12px rgba(45,35,24,0.08)" }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>{editId ? "✏️ 編輯訂單" : "新增訂單"}</div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>客人姓名 *</label>
              <select value={form.customer} onChange={e => handleChange("customer", e.target.value)} style={inputStyle}>
                <option value="">請選擇客人</option>
                {customers.map(c => <option key={c}>{c}</option>)}
              </select>
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <input placeholder="新增客人名稱" value={newCustomer} onChange={e => setNewCustomer(e.target.value)}
                  style={{ ...inputStyle, flex: 1 }} onKeyDown={e => e.key === "Enter" && addCustomer()} />
                <button onClick={addCustomer} style={smallBtnStyle}>新增</button>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>商品名稱 *</label>
              <input value={form.product} onChange={e => handleChange("product", e.target.value)}
                placeholder="例：日本・muji 隨身牙膏錠 20入" style={inputStyle} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>款式 / 顏色</label>
              <input value={form.style} onChange={e => handleChange("style", e.target.value)}
                placeholder="例：深藍色" style={inputStyle} />
            </div>

            <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>售價（台幣）*</label>
                <input type="number" value={form.price} onChange={e => handleChange("price", e.target.value)} placeholder="0" style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>成本（批價）</label>
                <input type="number" value={form.cost} onChange={e => handleChange("cost", e.target.value)} placeholder="0" style={inputStyle} />
              </div>
              <div style={{ width: 72 }}>
                <label style={labelStyle}>數量</label>
                <input type="number" value={form.qty} onChange={e => handleChange("qty", e.target.value)} min="1" style={inputStyle} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>廠商</label>
                <select value={form.supplier} onChange={e => handleChange("supplier", e.target.value)} style={inputStyle}>
                  <option value="">請選擇</option>
                  {SUPPLIERS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div style={{ width: 100 }}>
                <label style={labelStyle}>重量(g)</label>
                <input type="number" value={form.weight} onChange={e => handleChange("weight", e.target.value)} placeholder="0" style={inputStyle} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
              <div style={{ width: 90 }}>
                <label style={labelStyle}>訂購月份</label>
                <select value={form.month} onChange={e => handleChange("month", e.target.value)} style={inputStyle}>
                  {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div style={{ width: 90 }}>
                <label style={labelStyle}>日期</label>
                <input value={form.date} onChange={e => handleChange("date", e.target.value)} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>備註</label>
                <input value={form.note} onChange={e => handleChange("note", e.target.value)} placeholder="備註" style={inputStyle} />
              </div>
            </div>

            {form.price && form.qty && (
              <div style={{ background: "#f5f0eb", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, display: "flex", gap: 16, flexWrap: "wrap" }}>
                <span>售價小計：<strong>NT$ {(Number(form.price) * Number(form.qty)).toLocaleString()}</strong></span>
                {form.cost && <span style={{ color: "#888" }}>成本：NT$ {(Number(form.cost) * Number(form.qty)).toLocaleString()}</span>}
                {form.cost && <span style={{ color: "#4a7c59", fontWeight: 700 }}>利潤：NT$ {((Number(form.price) - Number(form.cost)) * Number(form.qty)).toLocaleString()}</span>}
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={handleSubmit} disabled={saving} style={{
                flex: 1, background: saving ? "#888" : "#2d2318", color: "#f5f0eb", border: "none",
                borderRadius: 8, padding: "13px", fontSize: 15, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer"
              }}>{saving ? "儲存中..." : editId ? "更新訂單" : "儲存訂單"}</button>
              {editId && (
                <button onClick={() => { setEditId(null); setForm(emptyForm); }} style={{
                  ...smallBtnStyle, padding: "13px 16px", background: "#e8e0d5", color: "#2d2318"
                }}>取消</button>
              )}
            </div>
            <div style={{ marginTop: 10, fontSize: 11, color: "#aaa", textAlign: "center" }}>☁️ 儲存後自動同步到 Google 試算表</div>
          </div>
        </div>
      )}

      {/* Overview Tab */}
      {tab === "overview" && (
        <div style={{ padding: 16 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {[["總筆數", orders.length + " 筆"], ["篩選數量", totalQty + " 個"], ["篩選金額", "NT$" + totalAmount.toLocaleString()]].map(([label, val]) => (
              <div key={label} style={{ flex: 1, background: "#2d2318", color: "#f5f0eb", borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
                <div style={{ fontSize: 10, opacity: 0.6, marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{val}</div>
              </div>
            ))}
          </div>

          <div style={{ background: "#fff", borderRadius: 10, padding: 12, marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>客人</div>
                <select value={filterCustomer} onChange={e => setFilterCustomer(e.target.value)} style={inputStyle}>
                  <option>全部</option>
                  {customers.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>狀態</div>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={inputStyle}>
                  {["全部","未訂貨","未到貨","未取貨","已完成"].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div style={{ fontSize: 11, color: "#888", marginBottom: 6 }}>月份</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {["全部", ...usedMonths.map(String)].map(m => (
                <button key={m} onClick={() => setFilterMonth(m)} style={{
                  border: "none", borderRadius: 20, padding: "4px 12px", fontSize: 12, cursor: "pointer",
                  background: filterMonth === m ? "#2d2318" : "#e8e0d5",
                  color: filterMonth === m ? "#f5f0eb" : "#2d2318",
                  fontWeight: filterMonth === m ? 700 : 400
                }}>{m === "全部" ? "全部" : `${m}月`}</button>
              ))}
              {usedMonths.length === 0 && <span style={{ fontSize: 12, color: "#bbb" }}>尚無訂單</span>}
            </div>
          </div>

          {Object.keys(grouped).length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "#aaa", fontSize: 14 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>☁️</div>
              <div>點右上角「從試算表載入」</div>
              <div>或點「新增訂單」開始記錄</div>
            </div>
          ) : (
            Object.entries(grouped).map(([customer, cOrders]) => {
              const cTotal = cOrders.reduce((s, o) => s + safeNum(o.price) * safeNum(o.qty), 0);
              return (
                <div key={customer} style={{ marginBottom: 16 }}>
                  <div style={{ background: "#2d2318", color: "#f5f0eb", borderRadius: "10px 10px 0 0", padding: "8px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{customer}</span>
                    <span style={{ fontSize: 12, opacity: 0.7 }}>{cOrders.length} 筆 ｜ NT${cTotal.toLocaleString()}</span>
                  </div>
                  {cOrders.map((o, i) => {
                    const waiting = !o.arrived ? waitingLabel(o.month) : null;
                    const profit = o.cost ? (safeNum(o.price) - safeNum(o.cost)) * safeNum(o.qty) : null;
                    const allDone = o.ordered && o.arrived && o.picked;
                    return (
                      <div key={o.id} style={{
                        background: "#fff", borderLeft: `3px solid ${allDone ? "#4a7c59" : "#2d2318"}`,
                        borderRight: "1px solid #e8e0d5",
                        borderBottom: i === cOrders.length - 1 ? "1px solid #e8e0d5" : "none",
                        borderRadius: i === cOrders.length - 1 ? "0 0 10px 10px" : 0,
                        padding: "10px 14px"
                      }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
                          <span style={{ background: monthColor(o.month), color: "#fff", borderRadius: 6, padding: "1px 7px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0 }}>{o.month}月</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: allDone ? "#aaa" : "#2d2318", textDecoration: allDone ? "line-through" : "none", flex: 1 }}>
                            {o.product}{o.style && <span style={{ color: "#888", fontWeight: 400 }}>／{o.style}</span>}
                          </span>
                          {waiting && <span style={{ background: "#fff3cd", color: "#856404", borderRadius: 6, padding: "1px 7px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0 }}>⏳ {waiting}</span>}
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 12px", fontSize: 12, color: "#666", marginBottom: 8 }}>
                          {o.price && <span>💴 NT${safeNum(o.price).toLocaleString()} × {o.qty} = <strong style={{ color: "#2d2318" }}>NT${(safeNum(o.price)*safeNum(o.qty)).toLocaleString()}</strong></span>}
                          {o.cost && <span style={{ color: "#888" }}>成本 NT${(safeNum(o.cost)*safeNum(o.qty)).toLocaleString()}</span>}
                          {profit !== null && <span style={{ color: profit >= 0 ? "#4a7c59" : "#c0392b", fontWeight: 600 }}>利潤 NT${profit.toLocaleString()}</span>}
                          {o.supplier && <span>🏪 {o.supplier}</span>}
                          {o.weight && <span>⚖️ {o.weight}g</span>}
                          {o.date && <span>📅 {o.date}</span>}
                          {o.note && <span>📝 {o.note}</span>}
                        </div>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          {[["ordered","已訂貨"],["arrived","到貨"],["picked","取貨"]].map(([field, label]) => (
                            <button key={field} onClick={() => toggleStatus(o.id, field)} style={{
                              border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontWeight: 600,
                              background: o[field] ? "#4a7c59" : "#e8e0d5", color: o[field] ? "#fff" : "#2d2318"
                            }}>{o[field] ? "✓ " : ""}{label}</button>
                          ))}
                          <button onClick={() => startEdit(o)} style={{ ...statusBtn, background: "#f0e8dc", marginLeft: "auto" }}>✏️</button>
                          <button onClick={() => deleteOrder(o.id)} style={{ ...statusBtn, background: "#fde8e8", color: "#c0392b" }}>🗑</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Arrived list tab */}
      {tab === "arrived" && (
        <div style={{ padding: 16 }}>
          {Object.keys(arrivedGrouped).length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "#aaa", fontSize: 14 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📦</div>
              <div>目前沒有「已到貨未取貨」的商品</div>
            </div>
          ) : (
            Object.entries(arrivedGrouped).map(([customer, cOrders]) => {
              const total = cOrders.reduce((s, o) => s + safeNum(o.price) * safeNum(o.qty), 0);
              const copyText = () => {
                const lines = cOrders.map(o => `・${o.product}${o.style ? "／" + o.style : ""} ×${o.qty}　NT$${(safeNum(o.price)*safeNum(o.qty)).toLocaleString()}`);
                const text = `📦 ${customer} 到貨通知\n\n${lines.join("\n")}\n\n總金額：NT$${total.toLocaleString()}\n請安排時間取貨，謝謝！`;
                navigator.clipboard.writeText(text);
                alert("已複製到剪貼簿！");
              };
              return (
                <div key={customer} style={{ marginBottom: 16, background: "#fff", borderRadius: 10, overflow: "hidden" }}>
                  <div style={{ background: "#2d2318", color: "#f5f0eb", padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{customer}</span>
                    <span style={{ fontSize: 12, opacity: 0.85 }}>總金額 NT${total.toLocaleString()}</span>
                  </div>
                  <div style={{ padding: "10px 14px" }}>
                    {cOrders.map((o, idx) => (
                      <div key={o.id} style={{ fontSize: 13, padding: "6px 0", borderBottom: idx === cOrders.length - 1 ? "none" : "1px dashed #e8e0d5", display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <span>・{o.product}{o.style && <span style={{ color: "#888" }}>／{o.style}</span>} ×{o.qty}</span>
                        <span style={{ whiteSpace: "nowrap", fontWeight: 600 }}>NT${(safeNum(o.price)*safeNum(o.qty)).toLocaleString()}</span>
                      </div>
                    ))}
                    <div style={{ borderTop: "1px solid #e8e0d5", marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>總金額：NT${total.toLocaleString()}</span>
                      <button onClick={copyText} style={{ background: "#4a7c59", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>📋 複製通知</button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

const labelStyle = { display: "block", fontSize: 12, color: "#888", marginBottom: 5, letterSpacing: 0.5 };
const inputStyle = { width: "100%", padding: "9px 12px", border: "1.5px solid #e8e0d5", borderRadius: 8, fontSize: 14, background: "#faf8f5", boxSizing: "border-box", marginBottom: 0, outline: "none", color: "#2d2318" };
const smallBtnStyle = { background: "#2d2318", color: "#f5f0eb", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" };
const statusBtn = { border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontWeight: 600 };
