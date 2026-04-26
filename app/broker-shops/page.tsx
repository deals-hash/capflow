'use client'

import { useState, useEffect, FormEvent } from 'react'

type Contact = {
  id: string
  name: string
  email: string
  phone: string | null
  role: string | null
  isPrimary: boolean
}

type Shop = {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  contacts: Contact[]
}

const emptyShop = (): Omit<Shop, 'id' | 'contacts'> => ({ name: '', phone: '', email: '', address: '', notes: '' })
const emptyContact = () => ({ name: '', email: '', phone: '', role: '', isPrimary: false })

export default function BrokerShopsPage() {
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Shop | null>(null)
  const [showNewShop, setShowNewShop] = useState(false)
  const [showNewContact, setShowNewContact] = useState(false)
  const [newShop, setNewShop] = useState(emptyShop())
  const [newContact, setNewContact] = useState(emptyContact())
  const [saving, setSaving] = useState(false)
  const [editShop, setEditShop] = useState<Shop | null>(null)

  const load = () => {
    setLoading(true)
    fetch('/api/broker-shops')
      .then(r => r.json())
      .then(d => { setShops(d.shops ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const refreshSelected = (id: string) => {
    fetch(`/api/broker-shops/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.shop) {
          setSelected(d.shop)
          setShops(prev => prev.map(s => s.id === id ? d.shop : s))
        }
      })
  }

  const createShop = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/broker-shops', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newShop) })
    const data = await res.json()
    setSaving(false)
    if (res.ok) {
      setShops(prev => [...prev, data.shop].sort((a, b) => a.name.localeCompare(b.name)))
      setNewShop(emptyShop())
      setShowNewShop(false)
      setSelected(data.shop)
    }
  }

  const saveEdit = async (e: FormEvent) => {
    e.preventDefault()
    if (!editShop) return
    setSaving(true)
    const res = await fetch(`/api/broker-shops/${editShop.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editShop) })
    const data = await res.json()
    setSaving(false)
    if (res.ok) {
      setShops(prev => prev.map(s => s.id === data.shop.id ? data.shop : s))
      setSelected(data.shop)
      setEditShop(null)
    }
  }

  const deleteShop = async (id: string) => {
    if (!confirm('Delete this broker shop? This cannot be undone.')) return
    await fetch(`/api/broker-shops/${id}`, { method: 'DELETE' })
    setShops(prev => prev.filter(s => s.id !== id))
    if (selected?.id === id) setSelected(null)
  }

  const addContact = async (e: FormEvent) => {
    e.preventDefault()
    if (!selected) return
    setSaving(true)
    const res = await fetch(`/api/broker-shops/${selected.id}/contacts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newContact) })
    setSaving(false)
    if (res.ok) {
      setNewContact(emptyContact())
      setShowNewContact(false)
      refreshSelected(selected.id)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', fontFamily: 'system-ui, -apple-system, sans-serif', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{ background: '#1e293b', borderBottom: '1px solid #334155', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <a href="/" style={{ color: '#94a3b8', fontSize: 13, textDecoration: 'none' }}>← CapFlow</a>
        <span style={{ color: '#334155' }}>|</span>
        <span style={{ fontWeight: 700, fontSize: 15 }}>Broker Shops</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => setShowNewShop(true)} style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
          + New Shop
        </button>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar list */}
        <div style={{ width: 280, borderRight: '1px solid #1e293b', overflowY: 'auto', padding: '12px 0' }}>
          {loading ? (
            <div style={{ padding: '24px 16px', color: '#64748b', fontSize: 13 }}>Loading…</div>
          ) : shops.length === 0 ? (
            <div style={{ padding: '24px 16px', color: '#64748b', fontSize: 13 }}>No shops yet. Create one.</div>
          ) : shops.map(s => (
            <button
              key={s.id}
              onClick={() => setSelected(s)}
              style={{
                width: '100%', textAlign: 'left', background: selected?.id === s.id ? '#1e293b' : 'transparent',
                border: 'none', borderLeft: `3px solid ${selected?.id === s.id ? '#6366f1' : 'transparent'}`,
                padding: '10px 16px', cursor: 'pointer', color: '#e2e8f0',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{s.contacts.length} contact{s.contacts.length !== 1 ? 's' : ''}</div>
            </button>
          ))}
        </div>

        {/* Detail panel */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 32 }}>
          {!selected ? (
            <div style={{ color: '#475569', fontSize: 14, paddingTop: 48, textAlign: 'center' }}>Select a shop to view details</div>
          ) : editShop ? (
            <form onSubmit={saveEdit}>
              <h2 style={{ margin: '0 0 24px', fontWeight: 700, fontSize: 20 }}>Edit Shop</h2>
              {(['name', 'phone', 'email', 'address', 'notes'] as const).map(f => (
                <div key={f} style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{f}</label>
                  <input
                    value={(editShop as Record<string, string | null>)[f] ?? ''}
                    onChange={e => setEditShop(prev => prev ? { ...prev, [f]: e.target.value } : prev)}
                    style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: '8px 12px', color: '#e2e8f0', fontSize: 14 }}
                  />
                </div>
              ))}
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="submit" disabled={saving} style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button type="button" onClick={() => setEditShop(null)} style={{ background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: 8, padding: '9px 20px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16 }}>
                <div>
                  <h2 style={{ margin: '0 0 6px', fontWeight: 800, fontSize: 24 }}>{selected.name}</h2>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    {selected.phone && <span style={{ fontSize: 13, color: '#94a3b8' }}>{selected.phone}</span>}
                    {selected.email && <span style={{ fontSize: 13, color: '#94a3b8' }}>{selected.email}</span>}
                    {selected.address && <span style={{ fontSize: 13, color: '#94a3b8' }}>{selected.address}</span>}
                  </div>
                  {selected.notes && <div style={{ fontSize: 13, color: '#64748b', marginTop: 8 }}>{selected.notes}</div>}
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button onClick={() => setEditShop(selected)} style={{ background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Edit</button>
                  <button onClick={() => deleteShop(selected.id)} style={{ background: 'transparent', border: '1px solid rgba(239,68,68,.4)', color: '#ef4444', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
                </div>
              </div>

              {/* Contacts */}
              <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Contacts</div>
                <button onClick={() => setShowNewContact(true)} style={{ background: 'transparent', border: '1px solid #334155', color: '#94a3b8', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>+ Add Contact</button>
              </div>

              {showNewContact && (
                <form onSubmit={addContact} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 20, marginBottom: 20 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>New Contact</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {(['name', 'email', 'phone', 'role'] as const).map(f => (
                      <div key={f}>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{f}</label>
                        <input
                          value={newContact[f]}
                          onChange={e => setNewContact(p => ({ ...p, [f]: e.target.value }))}
                          required={f === 'name' || f === 'email'}
                          style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 6, padding: '7px 10px', color: '#e2e8f0', fontSize: 13 }}
                        />
                      </div>
                    ))}
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 13, color: '#94a3b8', cursor: 'pointer' }}>
                    <input type="checkbox" checked={newContact.isPrimary} onChange={e => setNewContact(p => ({ ...p, isPrimary: e.target.checked }))} />
                    Primary contact
                  </label>
                  <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                    <button type="submit" disabled={saving} style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                      {saving ? 'Saving…' : 'Add'}
                    </button>
                    <button type="button" onClick={() => { setShowNewContact(false); setNewContact(emptyContact()) }} style={{ background: 'transparent', border: '1px solid #334155', color: '#94a3b8', borderRadius: 8, padding: '8px 18px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                  </div>
                </form>
              )}

              {selected.contacts.length === 0 ? (
                <div style={{ color: '#475569', fontSize: 13 }}>No contacts yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {selected.contacts.map(c => (
                    <div key={c.id} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 700, fontSize: 14 }}>{c.name}</span>
                          {c.isPrimary && <span style={{ fontSize: 10, background: '#6366f1', color: '#fff', borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>PRIMARY</span>}
                          {c.role && <span style={{ fontSize: 12, color: '#64748b' }}>{c.role}</span>}
                        </div>
                        <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{c.email}{c.phone ? ` · ${c.phone}` : ''}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* New shop modal */}
      {showNewShop && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
          onClick={() => setShowNewShop(false)}>
          <form onSubmit={createShop} onClick={e => e.stopPropagation()}
            style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: 32, width: '100%', maxWidth: 480 }}>
            <h3 style={{ margin: '0 0 24px', fontWeight: 700, fontSize: 18 }}>New Broker Shop</h3>
            {(['name', 'phone', 'email', 'address', 'notes'] as const).map(f => (
              <div key={f} style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{f}{f === 'name' ? ' *' : ''}</label>
                <input
                  value={(newShop as Record<string, string>)[f]}
                  onChange={e => setNewShop(p => ({ ...p, [f]: e.target.value }))}
                  required={f === 'name'}
                  style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '9px 12px', color: '#e2e8f0', fontSize: 14 }}
                />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button type="submit" disabled={saving} style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 22px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                {saving ? 'Creating…' : 'Create Shop'}
              </button>
              <button type="button" onClick={() => setShowNewShop(false)} style={{ background: 'transparent', border: '1px solid #334155', color: '#94a3b8', borderRadius: 8, padding: '10px 22px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
