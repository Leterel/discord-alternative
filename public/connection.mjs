// Reduce RTC statistics to a useful status without exposing IPs or credentials.
export function describeConnection(stats) {
  const reports = [...stats.values()];
  const selectedIds = reports.filter(report => report.type === 'transport')
    .map(report => report.selectedCandidatePairId).filter(Boolean);
  const pairs = selectedIds.length
    ? selectedIds.map(id => stats.get(id)).filter(Boolean)
    : reports.filter(report => report.type === 'candidate-pair' && report.selected === true);
  const active = pairs.filter(pair => pair.state === 'succeeded');
  if (!active.length) return { kind: 'unknown', label: '● Verbindung aktiv', hint: 'Der Verbindungsweg wird noch ermittelt.' };
  const candidates = active.flatMap(pair => [stats.get(pair.localCandidateId), stats.get(pair.remoteCandidateId)]);
  const relay = candidates.some(candidate => candidate?.candidateType === 'relay');
  const directTypes = ['host', 'srflx', 'prflx'];
  const direct = candidates.every(candidate => directTypes.includes(candidate?.candidateType));
  const roundTrips = active.map(pair => pair.currentRoundTripTime)
    .filter(value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 60);
  const rttMs = roundTrips.length ? Math.round(Math.max(...roundTrips) * 1000) : undefined;
  const suffix = rttMs === undefined ? '' : ` · ${rttMs} ms`;
  if (relay) return { kind: 'relay', rttMs, label: '● Über Vermittlungsserver' + suffix,
    hint: 'Eure Verbindung nutzt TURN als Vermittler. Die WebRTC-Nutzdaten bleiben verschlüsselt.' };
  if (direct) return { kind: 'direct', rttMs, label: '● Direkt verbunden' + suffix,
    hint: 'Chat und Medien laufen direkt zwischen euren Geräten. Der Server hilft beim Verbindungsaufbau.' };
  return { kind: 'unknown', rttMs, label: '● Verbindung aktiv' + suffix,
    hint: 'Die Verbindung steht; der genaue Übertragungsweg ist noch nicht bekannt.' };
}

export function serverCloseMessage(code) {
  return ({
    4001: 'Die Anmeldung hat zu lange gedauert. Bitte erneut verbinden.',
    4002: 'Name oder Raum ist ungültig. Nutze für den Raum nur Buchstaben, Zahlen, _ und -.',
    4003: 'Der Raumschlüssel stimmt nicht. Bitte mit dem Schlüssel eures Servers vergleichen.',
    4004: 'Das Sofa ist voll: In diesen Raum passen genau zwei Menschen.',
    4008: 'Zu viele Anfragen. Warte kurz und verbinde dich erneut.',
    1006: 'Serververbindung abgebrochen. Prüfe Serveradresse, Internet und das Zertifikat eures Servers.'
  })[code] || 'Verbindung zum Server beendet. Bitte erneut verbinden.';
}
