import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AppPage } from '../../components/layout/AppPage';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { Icon } from '../../components/ui/Icon';
import { Spinner } from '../../components/ui/Spinner';
import { statusLabel } from '../../components/ui/StatusPill';
import { conversationPath, petPath, reportPath, requestPath, listingRequestsPath, ROUTES } from '../../lib/routes';
import { ApiRequestError } from '../../services/api/client';
import { looksRisky, messagesService, type ChatMessage, type Conversation, type ConversationSummary } from '../../services/messages/messagesService';
import { refreshCounts } from '../../services/me/useCounts';
import { petsService } from '../../services/pets/petsService';
import styles from './MessagesPage.module.css';

const POLL_THREAD = 10_000;
const POLL_LIST = 30_000;

const time = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const diff = Math.round((new Date(today.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}
function listTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  return diff < 86_400_000 && new Date(iso).getDate() === new Date().getDate()
    ? time(iso)
    : new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Re-runs `fn` on an interval while the tab is visible. */
function usePolling(fn: () => void, ms: number, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const tick = () => document.visibilityState === 'visible' && fn();
    const id = window.setInterval(tick, ms);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [fn, ms, enabled]);
}

/** Figma 14:61 — Messages. */
export function MessagesPage() {
  const { conversationId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const listingParam = params.get('listing');
  const [items, setItems] = useState<ConversationSummary[] | null>(null);
  const [query, setQuery] = useState('');
  const [listFailed, setListFailed] = useState(false);

  const loadList = useCallback(() => {
    messagesService
      .list()
      .then((list) => {
        setItems(list);
        setListFailed(false);
      })
      .catch(() => setListFailed(true));
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList, conversationId]);
  usePolling(loadList, POLL_LIST);

  // Arriving from a pet profile: open the existing conversation, or compose a new one.
  const [composeFor, setComposeFor] = useState<{ id: string; name: string; lister: string } | null>(null);
  useEffect(() => {
    if (!listingParam || conversationId) return;
    let active = true;
    messagesService
      .lookup(listingParam)
      .then(async (existing) => {
        if (!active) return;
        if (existing) {
          navigate(conversationPath(existing), { replace: true });
          return;
        }
        const pet = await petsService.get(listingParam);
        if (active) setComposeFor({ id: pet.id, name: pet.name, lister: pet.lister.type === 'organization' ? pet.lister.name : 'the pet parent' });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [listingParam, conversationId, navigate]);

  const filtered = (items ?? []).filter((c) => {
    const q = query.trim().toLowerCase();
    return !q || c.otherName.toLowerCase().includes(q) || c.listing.name.toLowerCase().includes(q);
  });
  const showingDetail = Boolean(conversationId || composeFor);

  return (
    <AppPage
      title="A little conversation goes a long way."
      documentTitle="Messages"
      subtitle="Keep questions, updates, and meet-and-greet plans in one safe place."
    >
      <div className={`${styles.layout} ${showingDetail ? styles.hasDetail : ''}`}>
        <aside className={styles.listCard} aria-label="Conversations">
          <label htmlFor="msg-search" className={styles.searchLabel}>
            Search conversations
          </label>
          <input
            id="msg-search"
            type="search"
            className={styles.search}
            placeholder="Search by pet or person"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {!items && !listFailed && (
            <div className={styles.center}>
              <Spinner size={24} label="Loading conversations" />
            </div>
          )}
          {listFailed && <p className={styles.muted}>We couldn’t load your conversations.</p>}
          {items && items.length === 0 && !composeFor && (
            <p className={styles.muted}>No conversations yet. Message a shelter or pet parent from a pet’s profile.</p>
          )}
          {items && items.length > 0 && filtered.length === 0 && <p className={styles.muted}>No conversations match “{query}”.</p>}
          <ul role="list" className={styles.list}>
            {filtered.map((c) => (
              <li key={c.id}>
                <Link
                  to={conversationPath(c.id)}
                  className={`${styles.item} ${c.id === conversationId ? styles.active : ''}`}
                  aria-current={c.id === conversationId ? 'page' : undefined}
                >
                  <Icon name="paw" size={26} className={styles.itemIcon} />
                  <span className={styles.itemBody}>
                    <span className={styles.itemName}>
                      {c.otherName}
                      {c.unread && (
                        <span className={styles.unreadDot}>
                          <span className="visually-hidden">unread</span>
                        </span>
                      )}
                    </span>
                    <span className={styles.itemMeta}>
                      About {c.listing.name}
                      {c.lastMessage && ` · ${listTime(c.lastMessage.at)}`}
                    </span>
                    {c.lastMessage && (
                      <span className={`${styles.itemPreview} ${c.unread ? styles.previewUnread : ''}`}>
                        {c.lastMessage.fromMe ? 'You: ' : ''}
                        {c.lastMessage.body}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </aside>

        <section className={styles.thread} aria-label="Conversation">
          {conversationId ? (
            <Thread key={conversationId} id={conversationId} onChanged={loadList} />
          ) : composeFor ? (
            <Compose pet={composeFor} />
          ) : (
            <div className={styles.placeholder}>
              <EmptyState
                tone="plain"
                title={items && items.length ? 'Choose a conversation.' : 'A conversation starts with hello.'}
                text={
                  items && items.length
                    ? 'Pick someone from the list to keep the conversation going.'
                    : 'When you contact a shelter or pet parent, your conversations will appear here.'
                }
                action={!items?.length ? <Button to={ROUTES.findPet}>Explore companions</Button> : undefined}
              />
            </div>
          )}
        </section>
      </div>
    </AppPage>
  );
}

function SafetyBanner() {
  return (
    <p className={styles.safety}>
      Keep it safe: meet in person, verify records, and never send a deposit before meeting. Don’t share passwords or payment information.
    </p>
  );
}

function Compose({ pet }: { pet: { id: string; name: string; lister: string } }) {
  const navigate = useNavigate();
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await messagesService.start(pet.id, body.trim());
      navigate(conversationPath(res.conversationId), { replace: true });
    } catch (err) {
      setSending(false);
      setError(err instanceof ApiRequestError ? err.message : 'Message couldn’t send. Your text is still here.');
    }
  }

  return (
    <div className={styles.threadInner}>
      <header className={styles.threadHead}>
        <Link to={ROUTES.messages} className={styles.back}>
          <Icon name="arrowLeft" size={16} /> All conversations
        </Link>
        <Icon name="paw" size={36} className={styles.itemIcon} />
        <div className={styles.threadWho}>
          <h2>New message</h2>
          <p>
            About <Link to={petPath(pet.id)}>{pet.name}</Link> · to {pet.lister}
          </p>
        </div>
      </header>
      <SafetyBanner />
      <div className={styles.messages}>
        <p className={styles.muted}>
          Introduce yourself and ask about {pet.name}. To be considered for adoption, you can also{' '}
          <Link to={`/pets/${pet.id}/apply`}>send an adoption request</Link>.
        </p>
      </div>
      {error && (
        <Alert tone="error" className={styles.sendError}>
          {error}
        </Alert>
      )}
      <form className={styles.composer} onSubmit={onSubmit}>
        <label htmlFor="compose" className="visually-hidden">
          Message
        </label>
        <textarea
          id="compose"
          className={styles.input}
          rows={1}
          maxLength={2000}
          placeholder="Write a thoughtful message…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <Button type="submit" loading={sending} disabled={!body.trim()} className={styles.send}>
          Send
        </Button>
      </form>
    </div>
  );
}

type Pending = { tempId: string; body: string; failed: boolean };

function Thread({ id, onChanged }: { id: string; onChanged: () => void }) {
  const [convo, setConvo] = useState<Conversation | null>(null);
  const [missing, setMissing] = useState(false);
  const [body, setBody] = useState('');
  const [pending, setPending] = useState<Pending[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const lastCount = useRef(0);

  const load = useCallback(() => {
    messagesService
      .get(id)
      .then((c) => {
        setConvo(c);
        refreshCounts();
      })
      .catch((err) => {
        if (err instanceof ApiRequestError && err.status === 404) setMissing(true);
      });
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);
  usePolling(load, POLL_THREAD, !missing);

  // Keep the newest message in view when messages arrive.
  useLayoutEffect(() => {
    const count = (convo?.messages.length ?? 0) + pending.length;
    if (count !== lastCount.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      lastCount.current = count;
    }
  }, [convo, pending]);

  async function deliver(text: string, tempId: string) {
    try {
      const msg = await messagesService.send(id, text);
      setPending((p) => p.filter((m) => m.tempId !== tempId));
      setConvo((c) => (c ? { ...c, messages: [...c.messages, msg] } : c));
      onChanged();
    } catch {
      setPending((p) => p.map((m) => (m.tempId === tempId ? { ...m, failed: true } : m)));
    }
  }

  function onSubmit(e?: FormEvent) {
    e?.preventDefault();
    const text = body.trim();
    if (!text) return;
    const tempId = `tmp-${Date.now()}`;
    setPending((p) => [...p, { tempId, body: text, failed: false }]);
    setBody('');
    void deliver(text, tempId);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  }

  async function toggleBlock() {
    if (!convo) return;
    setBusy(true);
    try {
      if (convo.blockedByMe) await messagesService.unblock(id);
      else await messagesService.block(id);
      setConfirmBlock(false);
      load();
    } finally {
      setBusy(false);
    }
  }

  if (missing) {
    return (
      <div className={styles.placeholder}>
        <EmptyState tone="plain" title="This conversation isn’t available." action={<Button to={ROUTES.messages}>All conversations</Button>} />
      </div>
    );
  }
  if (!convo) {
    return (
      <div className={styles.center}>
        <Spinner size={28} label="Loading conversation" />
      </div>
    );
  }

  // Group messages by day for the separators.
  const groups: { day: string; messages: ChatMessage[] }[] = [];
  for (const m of convo.messages) {
    const day = dayLabel(m.at);
    const last = groups.at(-1);
    if (last && last.day === day) last.messages.push(m);
    else groups.push({ day, messages: [m] });
  }
  const lastMine = [...convo.messages].reverse().find((m) => m.fromMe);
  const readByOther = lastMine && convo.otherLastReadAt && new Date(convo.otherLastReadAt) >= new Date(lastMine.at);
  const context = [
    `About ${convo.listing.name}`,
    convo.requestStatus ? `Adoption request ${statusLabel(convo.requestStatus).toLowerCase()}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className={styles.threadInner}>
      <header className={styles.threadHead}>
        <Link to={ROUTES.messages} className={styles.back}>
          <Icon name="arrowLeft" size={16} /> All conversations
        </Link>
        <Icon name="paw" size={36} className={styles.itemIcon} />
        <div className={styles.threadWho}>
          <h2>{convo.otherName}</h2>
          <p>
            <Link to={petPath(convo.listing.id)}>{context}</Link>
            {convo.requestId && (
              <>
                {' · '}
                <Link to={convo.viewerIsLister ? `${listingRequestsPath(convo.listing.id)}?request=${convo.requestId}` : requestPath(convo.requestId)}>
                  View request
                </Link>
              </>
            )}
          </p>
        </div>
        <div className={styles.menuWrap}>
          <button type="button" className={styles.reportButton} aria-expanded={menuOpen} aria-controls={menuId} onClick={() => setMenuOpen((o) => !o)}>
            Report / block
          </button>
          <ul id={menuId} role="list" className={styles.menu} hidden={!menuOpen}>
            <li>
              <Link to={reportPath('conversation', convo.id)} className={styles.menuItem}>
                Report this conversation
              </Link>
            </li>
            <li>
              <button
                type="button"
                className={styles.menuItem}
                onClick={() => {
                  setMenuOpen(false);
                  if (convo.blockedByMe) void toggleBlock();
                  else setConfirmBlock(true);
                }}
              >
                {convo.blockedByMe ? `Unblock ${convo.otherName}` : `Block ${convo.otherName}`}
              </button>
            </li>
          </ul>
        </div>
      </header>

      <SafetyBanner />

      <div ref={scrollRef} className={styles.messages} role="log" aria-live="polite" aria-label={`Messages with ${convo.otherName}`}>
        {groups.map((g) => (
          <div key={g.day} className={styles.group}>
            <p className={styles.day}>{g.day}</p>
            {g.messages.map((m) => (
              <div key={m.id} className={`${styles.message} ${m.fromMe ? styles.mine : styles.theirs}`}>
                <p className={styles.bubble}>{m.body}</p>
                <p className={styles.meta}>
                  {m.fromMe ? 'You' : convo.otherName} · {time(m.at)}
                  {m.fromMe && m === lastMine && (readByOther ? ' · Read' : ' · Sent')}
                </p>
                {!m.fromMe && looksRisky(m.body) && (
                  <p className={styles.warn}>
                    <Icon name="alert" size={14} /> Be careful: never send money or a deposit before meeting in person.{' '}
                    <Link to={reportPath('conversation', convo.id)}>Report</Link>
                  </p>
                )}
              </div>
            ))}
          </div>
        ))}
        {pending.map((p) => (
          <div key={p.tempId} className={`${styles.message} ${styles.mine}`}>
            <p className={`${styles.bubble} ${p.failed ? styles.failedBubble : styles.sending}`}>{p.body}</p>
            {p.failed ? (
              <p className={styles.failed} role="alert">
                Message couldn’t send. Your text is still here.{' '}
                <button
                  type="button"
                  onClick={() => {
                    setPending((list) => list.map((m) => (m.tempId === p.tempId ? { ...m, failed: false } : m)));
                    void deliver(p.body, p.tempId);
                  }}
                >
                  Retry
                </button>
              </p>
            ) : (
              <p className={styles.meta}>Sending…</p>
            )}
          </div>
        ))}
      </div>

      {convo.canSend ? (
        <form className={styles.composer} onSubmit={onSubmit}>
          <label htmlFor="reply" className="visually-hidden">
            Message {convo.otherName}
          </label>
          <textarea
            id="reply"
            className={styles.input}
            rows={1}
            maxLength={2000}
            placeholder="Write a thoughtful message…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={onKeyDown}
            aria-describedby="reply-hint"
          />
          <Button type="submit" disabled={!body.trim()} className={styles.send}>
            Send
          </Button>
          <p id="reply-hint" className="visually-hidden">
            Press Enter to send, Shift and Enter for a new line.
          </p>
        </form>
      ) : (
        <p className={styles.blocked}>
          {convo.blockedByMe ? `You blocked ${convo.otherName}. Unblock them to send messages.` : 'Messages can’t be sent in this conversation.'}
        </p>
      )}

      <Dialog
        open={confirmBlock}
        title={`Block ${convo.otherName}?`}
        onClose={() => setConfirmBlock(false)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirmBlock(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={toggleBlock} loading={busy}>
              Block
            </Button>
          </>
        }
      >
        They won’t be able to message you or send new adoption requests for your pets. If something felt unsafe, please also report the
        conversation so our team can review it.
      </Dialog>
    </div>
  );
}
