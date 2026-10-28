import { Clock, History, Pencil, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

export interface ActivityTimelineEvent {
  id: string;
  action: string;
  description?: string | null;
  entityType?: string;
  entityId?: string;
  userId?: string | null;
  user?: { firstName?: string; lastName?: string } | null;
  createdAt: string | Date;
}

interface ActivityTimelineProps {
  events: unknown;
  fallbackEvents?: ActivityTimelineEvent[];
  entityType?: string;
  entityId?: string;
  isLoading?: boolean;
  isError?: boolean;
  subtitle: string;
}

const actionIcons: Record<string, typeof History> = {
  CREATE: Plus,
  UPDATE: Pencil,
  DELETE: Trash2,
};

interface ParsedChange {
  label: string;
  from?: string;
  to?: string;
  raw?: string;
}

function isPlaceholderOrUnknown(val?: string | null): boolean {
  if (!val) return true;
  const str = String(val).trim();
  const lower = str.toLowerCase();
  const digits = str.replace(/\D/g, '');
  if (digits && (/^0+$/.test(digits) || digits.startsWith('00') || /^(?:91)?0{7,}$/.test(digits))) {
    return true;
  }
  return (
    str === '' ||
    str === 'N/A' ||
    str === '-' ||
    lower === '(empty)' ||
    lower === 'null' ||
    lower === 'undefined' ||
    lower === 'none' ||
    lower.includes('unknown') ||
    lower.includes('unuse') ||
    lower.includes('unused')
  );
}

function cleanCompositeValue(label: string, val: string): string {
  if (!val) return val;
  let clean = val.trim();
  if (clean.includes('\n')) {
    clean = clean.split('\n')[0].trim();
  }
  if (label === 'EMI Case') {
    return /^yes/i.test(clean) ? 'Yes' : (/^no/i.test(clean) ? 'No' : clean);
  }
  if (label === 'Preventive Health Checkup') {
    return /^yes/i.test(clean) ? 'Yes' : (/^no/i.test(clean) ? 'No' : clean);
  }
  if (label === 'Payment Mode' && clean.includes(',')) {
    return clean.split(',')[0].trim();
  }
  if (label.startsWith('Connected Person')) {
    const nameMatch = clean.match(/Name:\s*([^,]+)/i);
    const relMatch = clean.match(/Relationship:\s*([^,]+)/i);
    if (nameMatch) {
      const pName = nameMatch[1].trim();
      const pRel = relMatch ? relMatch[1].trim() : '';
      return pRel ? `${pName} (${pRel})` : pName;
    }
  }
  if (label.startsWith('Nominee Details')) {
    const nameMatch = clean.match(/Name:\s*([^,]+)/i);
    const shareMatch = clean.match(/Share:\s*([^,]+)/i);
    if (nameMatch) {
      const nName = nameMatch[1].trim();
      const nShare = shareMatch ? shareMatch[1].trim() : '';
      return nShare ? `${nName} (${nShare})` : nName;
    }
  }
  return clean;
}

const KNOWN_POLICY_NOTE_KEYS = [
  'Policy Type', 'Customer Category', 'Insurance Company Category', 'Company Category',
  'Insurance Company', 'Company Name', 'Insurance Plan Category', 'Plan Category',
  'Agent Name', 'Policy Zone Location City', 'Policy Zone City', 'Policy Zone Location Tier',
  'Policy Zone Location Pincode', 'Policy Tenure', 'Policy Term', 'Insured Person',
  'First Premium Date', 'Last Premium Date', 'Premium Payment Period', 'No. of Installments',
  'Last Installment Date', '1st Installment Date', 'Installment Date', 'Installment Amount',
  'Downpayment Amount', 'Processing Fee', 'EMI Case', 'Payment Mode', 'Payment Date',
  'Preventive Health Checkup', 'PHC Status', 'PHC Stage', 'PHC Insured Person', 'PHC Utilized Amount',
  'Bank Details', 'GST Details', 'Loan Case', 'Loan Amount', 'Installment Comment',
  '1st Year Premium Amount', '2nd Year Onwards Premium Amount', 'Age at Entry', 'Age at Last Premium', 'Age at Maturity'
];

function isInsideParens(str: string, index: number): boolean {
  let depth = 0;
  for (let i = 0; i < index; i++) {
    if (str[i] === '(') depth++;
    else if (str[i] === ')') depth = Math.max(0, depth - 1);
  }
  return depth > 0;
}

function parseStructuredNotes(text?: string | null): Record<string, string> {
  if (!text) return {};
  const map: Record<string, string> = {};
  const clean = text.replace(/\r\n/g, '\n');
  const sortedKeys = [...KNOWN_POLICY_NOTE_KEYS].sort((a, b) => b.length - a.length);
  const pattern = new RegExp('(?:^|[\\n\\s])(' + sortedKeys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + '):\\s*', 'gi');

  const matches: { key: string; valueStart: number; index: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(clean)) !== null) {
    const startIndex = m.index + (m[0].length - m[1].length - (m[0].endsWith(': ') ? 2 : 1));
    if (isInsideParens(clean, startIndex)) continue;
    matches.push({
      key: m[1].trim(),
      valueStart: m.index + m[0].length,
      index: startIndex,
    });
  }

  for (let i = 0; i < matches.length; i++) {
    const k = matches[i].key;
    const start = matches[i].valueStart;
    const end = (i + 1 < matches.length) ? matches[i + 1].index : clean.length;
    let val = clean.slice(start, end).trim().replace(/[,\s]+$/, '');
    if (k && val && !isPlaceholderOrUnknown(val)) {
      map[k] = val;
    }
  }

  return map;
}

function parseActivityDescription(desc?: string | null): { title: string; changes: ParsedChange[] } {
  if (!desc) return { title: '', changes: [] };

  const colonIdx = desc.indexOf(': ');
  if (colonIdx === -1) {
    return { title: desc, changes: [] };
  }

  const potentialTitle = desc.slice(0, colonIdx).trim();
  const rest = desc.slice(colonIdx + 2).trim();

  // Split only by semicolon; commas should never split fields because values contain commas
  const segments = rest.includes(';')
    ? rest.split(';').map(s => s.trim()).filter(Boolean)
    : [rest];
  const changes: ParsedChange[] = [];

  for (const segment of segments) {
    const arrowIdx = segment.indexOf(' -> ') !== -1 ? segment.indexOf(' -> ') : segment.indexOf(' → ');
    if (arrowIdx !== -1) {
      const arrowLength = segment.indexOf(' -> ') !== -1 ? 4 : 3;
      const leftPart = segment.slice(0, arrowIdx).trim();
      const rightPart = segment.slice(arrowIdx + arrowLength).trim();

      const colon = leftPart.indexOf(': ');
      let label = 'Details';
      let from = leftPart;
      let to = rightPart;

      if (colon !== -1) {
        label = leftPart.slice(0, colon).trim();
        from = leftPart.slice(colon + 2).trim();
      }

      if (isPlaceholderOrUnknown(label)) continue;

      // Handle structured notes diff so huge internal note blobs are never dumped
      const isNotesField = label.toLowerCase() === 'notes' || label.toLowerCase() === 'note';
      const hasStructuredPolicyText = from.includes('Policy Type:') || to.includes('Policy Type:') || from.includes('Customer Category:') || to.includes('Customer Category:');

      if (isNotesField || hasStructuredPolicyText) {
        const mapFrom = parseStructuredNotes(from);
        const mapTo = parseStructuredNotes(to);
        const allKeys = Array.from(new Set([...Object.keys(mapFrom), ...Object.keys(mapTo)]));
        let addedSubChange = false;

        for (const k of allKeys) {
          const v1 = mapFrom[k];
          const v2 = mapTo[k];
          if (v1 !== v2) {
            const isV1Empty = isPlaceholderOrUnknown(v1);
            const isV2Empty = isPlaceholderOrUnknown(v2);
            if (isV1Empty && isV2Empty) continue;
            changes.push({
              label: k,
              from: isV1Empty ? undefined : v1,
              to: isV2Empty ? '(empty)' : v2,
            });
            addedSubChange = true;
          }
        }

        if (addedSubChange) continue;
        if (from.toLowerCase() === to.toLowerCase()) continue;

        // If it was just simple text note (not structured keys)
        if (Object.keys(mapFrom).length === 0 && Object.keys(mapTo).length === 0) {
          if (!isPlaceholderOrUnknown(from) || !isPlaceholderOrUnknown(to)) {
            changes.push({
              label: 'Remarks',
              from: isPlaceholderOrUnknown(from) ? undefined : from,
              to: isPlaceholderOrUnknown(to) ? '(empty)' : to,
            });
          }
        }
        continue;
      }

      from = cleanCompositeValue(label, from);
      to = cleanCompositeValue(label, to);

      if (from.toLowerCase() === to.toLowerCase()) continue;
      if (isPlaceholderOrUnknown(from) && isPlaceholderOrUnknown(to)) continue;
      if (isPlaceholderOrUnknown(to)) continue;

      const isFromEmpty = isPlaceholderOrUnknown(from);
      changes.push({
        label,
        from: isFromEmpty ? undefined : from,
        to,
      });
    } else {
      const colon = segment.indexOf(': ');
      if (colon !== -1) {
        const label = segment.slice(0, colon).trim();
        let to = segment.slice(colon + 2).trim();
        if (isPlaceholderOrUnknown(label) || isPlaceholderOrUnknown(to)) continue;

        if (label.toLowerCase() === 'notes' || label.toLowerCase() === 'note' || to.includes('Policy Type:') || to.includes('Customer Category:')) {
          const mapTo = parseStructuredNotes(to);
          const keys = Object.keys(mapTo);
          if (keys.length > 0) {
            for (const k of keys) {
              const val = mapTo[k];
              if (!isPlaceholderOrUnknown(val)) {
                changes.push({ label: k, to: val });
              }
            }
            continue;
          }
        }

        to = cleanCompositeValue(label, to);
        if (isPlaceholderOrUnknown(to)) continue;
        changes.push({
          label,
          to,
        });
      } else {
        if (isPlaceholderOrUnknown(segment)) continue;
        changes.push({
          label: 'Details',
          raw: segment,
          to: segment,
        });
      }
    }
  }
  return { title: potentialTitle, changes };
}

export default function ActivityTimeline({
  events,
  fallbackEvents = [],
  entityType,
  entityId,
  isLoading = false,
  isError = false,
  subtitle,
}: ActivityTimelineProps) {
  const collectedEvents: ActivityTimelineEvent[] = [];
  const collectEvents = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(collectEvents);
      return;
    }
    if (!value || typeof value !== 'object') return;

    const record = value as Record<string, unknown>;
    if (typeof record.action === 'string' && record.createdAt) {
      collectedEvents.push(record as unknown as ActivityTimelineEvent);
      return;
    }
    if ('data' in record) collectEvents(record.data);
  };
  collectEvents(events);
  const uniqueEvents = new Map<string, ActivityTimelineEvent>();
  const visibleEvents = [
    ...collectedEvents,
    ...fallbackEvents.filter(fallback => !collectedEvents.some(event =>
      event.entityType === fallback.entityType &&
      event.entityId === fallback.entityId &&
      event.action === fallback.action
    )),
  ];
  visibleEvents.forEach((event, index) => {
    if (entityType && event.entityType?.toLowerCase() !== entityType.toLowerCase() && (event as any).contactId !== entityId) return;
    if (entityId && event.entityId !== entityId && (event as any).contactId !== entityId) return;
    const key = event.id || `${event.entityType}-${event.entityId}-${event.action}-${event.createdAt}-${index}`;
    const existing = uniqueEvents.get(key);
    if (!existing || (!existing.user && event.user)) {
      uniqueEvents.set(key, event);
    }
  });

  const latestFirst = [...uniqueEvents.values()].filter(event => {
    const desc = (event.description || '').trim();
    if (!desc) return false;
    // 1. Filter out generic uninformative interceptor logs like "UPDATE operation on Contact"
    if (/^[A-Z]+\s+operation\s+on\s+[A-Za-z]+$/i.test(desc)) {
      return false;
    }
    // 2. Filter out "no tracked fields changed" logs
    if (/no tracked fields changed/i.test(desc)) {
      return false;
    }
    // 3. Filter out unknown / unuse / placeholder descriptions
    if (/^(unknown|unuse|unused|null|undefined|n\/a)$/i.test(desc)) {
      return false;
    }
    // 4. For UPDATE actions with field changes, ensure at least one actual change remains
    if (event.action?.toUpperCase() === 'UPDATE') {
      const { changes } = parseActivityDescription(event.description);
      if (changes.length === 0) {
        return false;
      }
      const colonIdx = desc.indexOf(': ');
      if (colonIdx !== -1) {
        const afterColon = desc.slice(colonIdx + 2).trim();
        if (!afterColon || isPlaceholderOrUnknown(afterColon) || /no tracked fields changed/i.test(afterColon)) {
          return false;
        }
      } else if (/^(Contact|Policy|Claim)\s+profile\s+updated$/i.test(desc) || /^(Contact|Policy|Claim)\s+updated$/i.test(desc)) {
        return false;
      }
    }
    return true;
  }).sort((a, b) => {
    const timestampA = new Date(a.createdAt).getTime();
    const timestampB = new Date(b.createdAt).getTime();
    return (Number.isNaN(timestampB) ? 0 : timestampB) - (Number.isNaN(timestampA) ? 0 : timestampA);
  });

  return (
    <section className="space-y-2.5">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
        <div className="flex min-w-0 items-start gap-2">
          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <History size={13} />
          </div>
          <div>
            <h3 className="text-[11px] font-extrabold uppercase tracking-wide text-slate-800">
              Audit Trail &amp; Activity History
            </h3>
            <p className="mt-0.5 text-[10px] text-slate-500">{subtitle}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[9px] font-extrabold text-emerald-700">
            Live Updates
          </span>
          <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[9px] font-extrabold text-blue-700">
            {isLoading ? 'Loading…' : `${latestFirst.length} ${latestFirst.length === 1 ? 'Event' : 'Events'} Total`}
          </span>
        </div>
      </div>

      <div className="relative mt-2.5 max-h-[420px] space-y-2.5 overflow-y-auto pl-3.5 pr-1 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-blue-200 custom-scrollbar">
        {isLoading && latestFirst.length === 0 ? (
          <div className="rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-7 text-center text-[11px] text-slate-500">
            Loading activity history…
          </div>
        ) : isError && latestFirst.length === 0 ? (
          <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-4 text-center text-[11px] font-medium text-rose-700">
            Activity history could not be loaded. Please try again.
          </div>
        ) : latestFirst.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/70 px-3 py-7 text-center text-[11px] text-slate-500">
            No activity has been recorded yet.
          </div>
        ) : latestFirst.map((event, index) => {
          const timestamp = new Date(event.createdAt);
          const timestampLabel = Number.isNaN(timestamp.getTime())
            ? 'Date unavailable'
            : format(timestamp, 'dd MMM yyyy, hh:mm a');
          const action = event.action?.toUpperCase() || 'ACTIVITY';
          const ActionIcon = actionIcons[action] || History;
          const entityType = event.entityType || 'Record';
          const actorName = [event.user?.firstName, event.user?.lastName].filter(Boolean).join(' ');
          const actor = actorName || (event.userId ? 'Team member' : 'System');

          return (
            <article
              key={event.id || `${event.createdAt}-${index}`}
              className="relative rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 shadow-2xs"
            >
              <span className="absolute -left-[17px] top-2.5 flex h-5 w-5 items-center justify-center rounded-full border border-indigo-400 bg-white text-indigo-600">
                <ActionIcon size={10} />
              </span>
              {(() => {
                const { title, changes } = parseActivityDescription(event.description);
                return (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h4 className="text-[10px] font-extrabold uppercase tracking-wide text-slate-800">
                        {title || `${entityType} ${action.toLowerCase()}`}
                      </h4>
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-1 text-[9px] font-bold text-slate-600">
                        <Clock size={10} />
                        {timestampLabel}
                      </span>
                    </div>

                    {changes.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {changes.map((ch, cIdx) => (
                          <div
                            key={cIdx}
                            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200/80 bg-slate-50/90 px-2 py-1 text-[10px]"
                          >
                            <span className="font-semibold text-slate-700">{ch.label}:</span>
                            {ch.from !== undefined && ch.from !== '(empty)' ? (
                              <>
                                <span className="line-through text-slate-400 font-medium">{ch.from}</span>
                                <span className="text-slate-400 font-bold text-[9px]">→</span>
                                <span className="font-bold text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200/60">
                                  {ch.to || '(empty)'}
                                </span>
                              </>
                            ) : (
                              <span className="font-bold text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200/60">
                                {ch.to || ch.raw}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2">
                <span className="rounded-md bg-slate-100 px-1.5 py-1 text-[9px] font-semibold text-slate-600">
                  By {actor}
                </span>
                <span className="rounded-md border border-indigo-200 bg-indigo-50 px-1.5 py-1 text-[9px] font-extrabold uppercase text-indigo-700">
                  {entityType} · {action}
                </span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
