import { signOffFixture } from '../test/signOffFixture'
import { describe, expect, it } from 'vitest'
import {
  attachPhoto,
  deliveryStatus,
  handoffErrors,
  proofStatus,
  type DriverProofDraft,
  type ProofStatus,
} from './driverProof'
import type { Evidence, QueuedAction, Stop } from './models'

const stop: Stop = {
  id: 'stop',
  outlet: 'outlet',
  name: 'Store',
  address: 'Receiving dock',
  window: '05:30–07:30',
  eta: '05:40',
  lat: 0,
  lng: 0,
  cases: 18,
  orderIds: ['order'],
  status: 'Delivered',
}
const evidence: Evidence = {
  id: 'photo',
  entityId: 'stop',
  kind: 'delivery',
  photo: new Blob(['photo'], { type: 'image/png' }),
  fileName: 'photo.png',
  createdAt: '2026-09-26T00:10:00Z',
  revision: 3,
  accepted: true,
  quantity: 18,
  receiver: 'Nimal',
  receiverException: '',
  ...signOffFixture({
    stopId: 'stop',
    quantity: 18,
    receiver: 'Nimal',
    exception: '',
    fileName: 'photo.png',
    revision: 3,
  }),
}
const record: QueuedAction = {
  id: 'record',
  stopId: 'stop',
  evidenceId: 'photo',
  kind: 'delivery',
  createdAt: evidence.createdAt,
  revision: 3,
  status: 'accepted',
  attempts: 1,
}
const draft: DriverProofDraft = {
  stopId: 'stop',
  photo: evidence.photo,
  fileName: evidence.fileName,
  stage: 'captured',
  quantity: 18,
  receiver: 'Nimal',
  acknowledged: true,
  exception: '',
  revision: 3,
  createdAt: evidence.createdAt,
  signature: evidence.signature,
  managerSignOff: evidence.managerSignOff,
}

describe('Driver proof transitions', () => {
  it.each<ProofStatus>(['none', 'captured', 'localPending', 'uploading', 'failed'])(
    'refuses Delivered when proof is %s, even if a stale stop says Delivered',
    (status) => {
      expect(deliveryStatus(stop, status)).toBe('pendingSync')
    },
  )
  it('requires a matching accepted delivery record and accepted evidence', () => {
    expect(proofStatus(evidence, record)).toBe('accepted')
    expect(deliveryStatus(stop, proofStatus(evidence, record))).toBe('delivered')
    expect(proofStatus({ ...evidence, accepted: false }, record)).not.toBe('accepted')
    expect(proofStatus(evidence, { ...record, evidenceId: 'unrelated' })).not.toBe('accepted')
    expect(proofStatus(evidence, { ...record, status: 'pending' })).not.toBe('accepted')
    expect(proofStatus({ ...evidence, kind: 'attempt' }, record)).not.toBe('accepted')
  })
  it('attachment leaves a captured local draft rather than accepted proof', () => {
    const attached = attachPhoto(draft)
    expect(attached.stage).toBe('attached')
    expect(draft.stage).toBe('captured')
    expect(proofStatus(undefined, undefined, attached)).toBe('captured')
    expect(() => attachPhoto({ ...draft, photo: new Blob() })).toThrow('Capture')
  })
  it('shows offline records as pending, and retry as failed until an upload starts', () => {
    expect(proofStatus({ ...evidence, accepted: false }, { ...record, status: 'pending' })).toBe(
      'localPending',
    )
    expect(proofStatus(evidence, { ...record, status: 'retry' })).toBe('failed')
    expect(proofStatus(evidence, { ...record, status: 'syncing' })).toBe('uploading')
  })
  it('requires manager sign-off and clears validity when handoff details change', () => {
    expect(handoffErrors(draft, 18)).toEqual([])
    expect(handoffErrors({ ...draft, signature: undefined }, 18)).toContain(
      'Store Manager e-signature is required before delivery completion.',
    )
    expect(handoffErrors({ ...draft, quantity: 16, acknowledged: false }, 18)).toEqual(
      expect.arrayContaining([
        'Explain the quantity difference.',
        'The Store Manager must confirm unloading and receipt.',
        'Handoff details changed after signing. Ask the Store Manager to sign again.',
      ]),
    )
    expect(
      handoffErrors(
        { ...draft, quantity: 16, acknowledged: false, exception: 'Receiver unavailable.' },
        18,
      ),
    ).not.toEqual([])
    expect(handoffErrors({ ...draft, quantity: NaN }, 18)).not.toEqual([])
  })
})
