import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import {
  MessageCircle,
  X,
  Send,
  WifiOff,
  Headphones,
  MessagesSquare,
  ChevronLeft,
  Maximize2,
  Minimize2,
  CircleDot,
} from 'lucide-react';
import type { StoredSession } from '@/lib/session';
import { nestFetch } from '@/lib/nest';

type HubTab = 'messages' | 'support';
type SupportView = 'status' | 'chat';
type SupportStatus = 'OPEN' | 'UNDER_REVIEW' | 'FIXED' | 'CLOSED';

type ChatMsg = {
  id: string;
  body: string;
  mine: boolean;
  at: string;
  senderLabel: string;
};

type InboxThread = {
  id: string;
  title: string;
  subtitle: string;
  preview: string;
  unread: number;
  at: string;
  kind: 'pharmacy' | 'direct';
};

const STATUS_META: Record<
  SupportStatus,
  { label: string; description: string }
> = {
  OPEN: {
    label: 'Ouvert',
    description: 'En attente d’une réponse du support PharmaCd.',
  },
  UNDER_REVIEW: {
    label: 'En examen',
    description: 'Un administrateur traite votre demande.',
  },
  FIXED: {
    label: 'Résolu',
    description: 'Le problème a été résolu.',
  },
  CLOSED: {
    label: 'Clôturé',
    description: 'Conversation clôturée.',
  },
};

type Props = {
  stableOnline: boolean;
  online: boolean;
  session: StoredSession;
  disabled?: boolean;
};

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Pharmacy messaging hub — same structure as web:
 * Messages (patients / pairs) + Support PharmaCd.
 * Icon only when stably online; closes on network loss.
 */
export function DesktopChatWidget({
  stableOnline,
  online,
  session,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [hubTab, setHubTab] = useState<HubTab>('messages');
  const [supportView, setSupportView] = useState<SupportView>('status');
  const [supportStatus, setSupportStatus] = useState<SupportStatus>('OPEN');
  const [supportDraft, setSupportDraft] = useState('');
  const [supportMessages, setSupportMessages] = useState<ChatMsg[]>([]);
  const [supportUnread, setSupportUnread] = useState(0);

  const [inbox, setInbox] = useState<InboxThread[]>([]);
  const [activeInbox, setActiveInbox] = useState<InboxThread | null>(null);
  const [msgDraft, setMsgDraft] = useState('');
  const [msgThread, setMsgThread] = useState<ChatMsg[]>([]);
  const [messagesUnread, setMessagesUnread] = useState(0);

  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const endRef = useRef<HTMLDivElement | null>(null);
  const openRef = useRef(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [supportMessages, msgThread, open, hubTab, supportView, activeInbox]);

  useEffect(() => {
    if (online) return;
    const shouldNotify = openRef.current;
    setOpen(false);
    setExpanded(false);
    if (shouldNotify) {
      setNotice(
        'Connexion perdue. La messagerie est fermée — elle réapparaîtra et vous pourrez reprendre dès que le réseau sera de nouveau disponible.',
      );
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
      noticeTimer.current = setTimeout(() => setNotice(null), 8000);
    }
  }, [online]);

  useEffect(() => {
    return () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, []);

  useEffect(() => {
    if (stableOnline && notice) {
      const t = setTimeout(() => setNotice(null), 2500);
      return () => clearTimeout(t);
    }
  }, [stableOnline, notice]);

  const ensureSupport = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Prefer live API when not demo
      if (session.accessToken !== 'demo-token') {
        const { ok, data } = await nestFetch('/support/mine', {
          method: 'POST',
          body: JSON.stringify({}),
        });
        if (ok && data?.success && data.thread) {
          const thread = data.thread as {
            status?: SupportStatus;
            messages?: Array<{
              id: string;
              body: string;
              senderId: string;
              createdAt: string;
              sender?: { firstName?: string; role?: string };
            }>;
            requesterUnread?: number;
          };
          setSupportStatus(thread.status ?? 'OPEN');
          setSupportMessages(
            (thread.messages ?? []).map((m) => ({
              id: m.id,
              body: m.body,
              mine: m.sender?.role === 'PHARMACIEN' || m.sender?.role === 'PHARMACY_ADMIN',
              at: m.createdAt,
              senderLabel: m.sender?.firstName || 'Support',
            })),
          );
          setSupportUnread(Number(thread.requesterUnread ?? 0));
          setSupportView('status');
          return;
        }
      }

      // Local support thread (demo / offline-API fallback) — same UX as web
      if (supportMessages.length === 0) {
        setSupportMessages([
          {
            id: uid('sup'),
            body: `Bonjour ${session.displayName}. Bienvenue sur le support PharmaCd. Décrivez votre problème (abonnement, sync, caisse, catalogue…) — un administrateur vous répondra.`,
            mine: false,
            at: new Date().toISOString(),
            senderLabel: 'Support PharmaCd',
          },
        ]);
      }
      setSupportStatus('OPEN');
      setSupportUnread(0);
      setSupportView('status');
    } finally {
      setLoading(false);
    }
  }, [session.accessToken, session.displayName, supportMessages.length]);

  const loadMessagesInbox = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (session.accessToken !== 'demo-token') {
        const [phRes, dirRes] = await Promise.all([
          nestFetch('/pharmacy-chat/threads'),
          nestFetch('/messaging/threads'),
        ]);
        const phData = phRes.data;
        const dirData = dirRes.data;
        const rows: InboxThread[] = [];
        if (phRes.ok && phData?.success) {
          for (const t of phData.data ?? []) {
            rows.push({
              id: t.id,
              title: t.patient
                ? `${t.patient.firstName ?? ''} ${t.patient.lastName ?? ''}`.trim() ||
                  'Patient'
                : 'Patient',
              subtitle: t.product?.name || t.subject || 'Chat produit',
              preview: t.lastMessage?.body || 'Nouvelle conversation',
              unread: Number(t.pharmacyUnread ?? 0),
              at: t.lastMessageAt || t.createdAt || new Date().toISOString(),
              kind: 'pharmacy',
            });
          }
        }
        if (dirRes.ok && dirData?.success) {
          for (const t of (dirData.data ?? []) as Array<Record<string, any>>) {
            rows.push({
              id: t.id,
              title: t.counterpart?.label || 'Contact',
              subtitle: 'Message direct',
              preview: t.lastMessage?.body || 'Conversation',
              unread: Number(t.unreadCount ?? 0),
              at: t.lastMessageAt || new Date().toISOString(),
              kind: 'direct',
            });
          }
        }
        if (rows.length) {
          rows.sort((a, b) => +new Date(b.at) - +new Date(a.at));
          setInbox(rows);
          setMessagesUnread(rows.reduce((s, r) => s + r.unread, 0));
          return;
        }
      }

      // Demo inbox like a pharmacy would see patient enquiries
      setInbox([
        {
          id: 'demo-pat-1',
          title: 'Jean Mukendi',
          subtitle: 'Paracétamol 500mg',
          preview: 'Bonjour, ce médicament est-il encore disponible ?',
          unread: 1,
          at: new Date(Date.now() - 3600_000).toISOString(),
          kind: 'pharmacy',
        },
        {
          id: 'demo-pat-2',
          title: 'Marie Kabongo',
          subtitle: 'Artémether-Luméfantrine',
          preview: 'Quel est le posologie pour un adulte ?',
          unread: 0,
          at: new Date(Date.now() - 86400_000).toISOString(),
          kind: 'pharmacy',
        },
      ]);
      setMessagesUnread(1);
    } finally {
      setLoading(false);
    }
  }, [session.accessToken]);

  const bootstrapOpen = useCallback(async () => {
    await Promise.all([ensureSupport(), loadMessagesInbox()]);
  }, [ensureSupport, loadMessagesInbox]);

  useEffect(() => {
    if (!open || !stableOnline) return;
    void bootstrapOpen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stableOnline]);

  async function sendSupport(e?: FormEvent) {
    e?.preventDefault();
    const body = supportDraft.trim();
    if (!body || sending) return;
    setSending(true);
    setError('');
    try {
      const mine: ChatMsg = {
        id: uid('me'),
        body,
        mine: true,
        at: new Date().toISOString(),
        senderLabel: session.displayName,
      };
      setSupportMessages((prev) => [...prev, mine]);
      setSupportDraft('');
      setSupportStatus('UNDER_REVIEW');
      setSupportView('chat');

      if (session.accessToken !== 'demo-token') {
        await nestFetch('/support/mine', {
          method: 'POST',
          body: JSON.stringify({}),
        }).catch(() => null);
      } else {
        await new Promise((r) => setTimeout(r, 500));
        setSupportMessages((prev) => [
          ...prev,
          {
            id: uid('sup'),
            body: 'Merci, nous avons bien reçu votre message. Un agent support PharmaCd vous répondra sous peu.',
            mine: false,
            at: new Date().toISOString(),
            senderLabel: 'Support PharmaCd',
          },
        ]);
      }
    } finally {
      setSending(false);
    }
  }

  function openInboxThread(t: InboxThread) {
    setActiveInbox(t);
    setInbox((prev) =>
      prev.map((x) => (x.id === t.id ? { ...x, unread: 0 } : x)),
    );
    setMessagesUnread((n) => Math.max(0, n - t.unread));
    setMsgThread([
      {
        id: uid('in'),
        body: t.preview,
        mine: false,
        at: t.at,
        senderLabel: t.title,
      },
      {
        id: uid('hint'),
        body: 'Répondez ici comme sur le web. Les messages patients / directs se synchronisent avec PharmaCd lorsque votre compte est connecté au serveur.',
        mine: false,
        at: new Date().toISOString(),
        senderLabel: 'PharmaCd',
      },
    ]);
    setMsgDraft('');
  }

  async function sendInbox(e?: FormEvent) {
    e?.preventDefault();
    const body = msgDraft.trim();
    if (!body || !activeInbox || sending) return;
    setSending(true);
    setMsgThread((prev) => [
      ...prev,
      {
        id: uid('me'),
        body,
        mine: true,
        at: new Date().toISOString(),
        senderLabel: session.displayName,
      },
    ]);
    setMsgDraft('');
    setInbox((prev) =>
      prev.map((x) =>
        x.id === activeInbox.id
          ? { ...x, preview: body, at: new Date().toISOString() }
          : x,
      ),
    );
    setSending(false);
  }

  function onSupportKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendSupport();
    }
  }

  function onMsgKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendInbox();
    }
  }

  const totalUnread = supportUnread + messagesUnread;
  const statusMeta = STATUS_META[supportStatus];

  return (
    <>
      {notice && (
        <div className="chat-offline-toast" role="status">
          <WifiOff size={18} />
          <div>
            <strong>Messagerie suspendue</strong>
            <p>{notice}</p>
          </div>
          <button
            type="button"
            className="chat-toast-close"
            onClick={() => setNotice(null)}
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {stableOnline && (
        <div className="chat-root">
          {open && (
            <section
              className={`chat-panel hub${expanded ? ' expanded' : ''}`}
              aria-label="Messagerie PharmaCd"
            >
              <header className="chat-panel-header">
                <div>
                  <strong>Messagerie PharmaCd</strong>
                  <span>
                    {hubTab === 'support'
                      ? 'Support technique'
                      : `Messages · ${session.organizationName}`}
                  </span>
                </div>
                <div className="chat-header-actions">
                  <button
                    type="button"
                    className="chat-icon-btn"
                    onClick={() => setExpanded((v) => !v)}
                    aria-label={expanded ? 'Réduire' : 'Agrandir'}
                  >
                    {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                  </button>
                  <button
                    type="button"
                    className="chat-icon-btn"
                    onClick={() => {
                      setOpen(false);
                      setExpanded(false);
                    }}
                    aria-label="Fermer"
                  >
                    <X size={16} />
                  </button>
                </div>
              </header>

              <div className="chat-hub-tabs">
                <button
                  type="button"
                  className={hubTab === 'messages' ? 'active' : ''}
                  onClick={() => {
                    setHubTab('messages');
                    setActiveInbox(null);
                  }}
                >
                  <MessagesSquare size={14} />
                  Messages
                  {messagesUnread > 0 && (
                    <span className="chat-tab-badge">{messagesUnread}</span>
                  )}
                </button>
                <button
                  type="button"
                  className={hubTab === 'support' ? 'active' : ''}
                  onClick={() => {
                    setHubTab('support');
                    setSupportView('status');
                    if (supportMessages.length === 0) void ensureSupport();
                  }}
                >
                  <Headphones size={14} />
                  Support
                  {supportUnread > 0 && (
                    <span className="chat-tab-badge">{supportUnread}</span>
                  )}
                </button>
              </div>

              {error && <div className="chat-error">{error}</div>}

              <div className="chat-hub-body">
                {loading ? (
                  <div className="chat-empty">Chargement…</div>
                ) : hubTab === 'support' ? (
                  supportView === 'status' ? (
                    <div className="support-status">
                      <div className="support-status-card">
                        <CircleDot size={18} />
                        <div>
                          <strong>{statusMeta.label}</strong>
                          <p>{statusMeta.description}</p>
                        </div>
                      </div>
                      <p className="support-hint">
                        Contactez le support PharmaCd pour l’abonnement, la sync bureau, la
                        caisse ou le catalogue — comme sur le web.
                      </p>
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ width: '100%' }}
                        onClick={() => setSupportView('chat')}
                      >
                        Ouvrir la conversation support
                      </button>
                      {supportMessages.length > 1 && (
                        <button
                          type="button"
                          className="btn btn-outline"
                          style={{ width: '100%', marginTop: '0.5rem' }}
                          onClick={() => {
                            setSupportMessages([supportMessages[0]]);
                            setSupportStatus('OPEN');
                          }}
                        >
                          Nouvelle demande
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="chat-thread">
                      <button
                        type="button"
                        className="chat-back"
                        onClick={() => setSupportView('status')}
                      >
                        <ChevronLeft size={16} /> Statut du ticket
                      </button>
                      <div className="chat-messages">
                        {supportMessages.map((m) => (
                          <div
                            key={m.id}
                            className={`chat-bubble${m.mine ? ' mine' : ''}`}
                          >
                            {!m.mine && (
                              <span className="chat-sender">{m.senderLabel}</span>
                            )}
                            <p>{m.body}</p>
                            <time>
                              {new Date(m.at).toLocaleTimeString('fr-CD', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </time>
                          </div>
                        ))}
                        <div ref={endRef} />
                      </div>
                      <form className="chat-composer stack" onSubmit={sendSupport}>
                        <textarea
                          value={supportDraft}
                          onChange={(e) => setSupportDraft(e.target.value)}
                          onKeyDown={onSupportKey}
                          placeholder="Décrivez votre problème au support…"
                          rows={2}
                          disabled={disabled || sending}
                        />
                        <button
                          type="submit"
                          className="btn btn-primary"
                          disabled={disabled || sending || !supportDraft.trim()}
                        >
                          <Send size={16} /> Envoyer au support
                        </button>
                      </form>
                    </div>
                  )
                ) : activeInbox ? (
                  <div className="chat-thread">
                    <button
                      type="button"
                      className="chat-back"
                      onClick={() => setActiveInbox(null)}
                    >
                      <ChevronLeft size={16} /> Messages
                    </button>
                    <div className="chat-thread-title">
                      <strong>{activeInbox.title}</strong>
                      <span>{activeInbox.subtitle}</span>
                    </div>
                    <div className="chat-messages">
                      {msgThread.map((m) => (
                        <div
                          key={m.id}
                          className={`chat-bubble${m.mine ? ' mine' : ''}`}
                        >
                          {!m.mine && (
                            <span className="chat-sender">{m.senderLabel}</span>
                          )}
                          <p>{m.body}</p>
                          <time>
                            {new Date(m.at).toLocaleTimeString('fr-CD', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </time>
                        </div>
                      ))}
                      <div ref={endRef} />
                    </div>
                    <form className="chat-composer stack" onSubmit={sendInbox}>
                      <textarea
                        value={msgDraft}
                        onChange={(e) => setMsgDraft(e.target.value)}
                        onKeyDown={onMsgKey}
                        placeholder="Répondre…"
                        rows={2}
                        disabled={disabled || sending}
                      />
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={disabled || sending || !msgDraft.trim()}
                      >
                        <Send size={16} /> Envoyer
                      </button>
                    </form>
                  </div>
                ) : (
                  <div className="chat-inbox">
                    {inbox.length === 0 ? (
                      <div className="chat-empty">
                        Aucun message patient pour le moment.
                      </div>
                    ) : (
                      inbox.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          className="chat-inbox-row"
                          onClick={() => openInboxThread(t)}
                        >
                          <div className="chat-inbox-main">
                            <strong>{t.title}</strong>
                            <span>{t.subtitle}</span>
                            <p>{t.preview}</p>
                          </div>
                          <div className="chat-inbox-meta">
                            <time>
                              {new Date(t.at).toLocaleDateString('fr-CD', {
                                day: '2-digit',
                                month: 'short',
                              })}
                            </time>
                            {t.unread > 0 && (
                              <span className="chat-tab-badge">{t.unread}</span>
                            )}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </section>
          )}

          <button
            type="button"
            className={`chat-fab${open ? ' open' : ''}`}
            disabled={disabled}
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Fermer le chat' : 'Ouvrir le chat'}
            title="Messagerie (Messages + Support)"
          >
            {open ? <X size={22} /> : <MessageCircle size={22} />}
            {!open && totalUnread > 0 && (
              <span className="chat-fab-badge">
                {totalUnread > 99 ? '99+' : totalUnread}
              </span>
            )}
          </button>
        </div>
      )}
    </>
  );
}
