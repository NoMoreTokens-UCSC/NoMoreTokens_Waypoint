import { useRef, useState, type FormEvent } from 'react'
import type { DriverProofDraft } from '../../../domain/driverProof'
import type { Order } from '../../../domain/models'
import { handoffErrors } from '../../../domain/driverProof'
import {
  hasSignatureInk,
  signOffBinding,
  type ManagerSignOff,
  type SignatureStroke,
} from '../../../domain/deliveryVerification'
import { useApis } from '../../providers/ApisContext'
import { useHandoffAction } from './useHandoffAction'
import { photoDigest } from '../../../domain/photoDigest'

export function useManagerHandoffForm(
  draft: DriverProofDraft,
  expected: number,
  orders: Order[],
  next: string,
) {
  const apis = useApis(),
    action = useHandoffAction()
  const [received, setReceived] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      orders.map((order) => [
        order.id,
        String(
          draft.managerSignOff?.orders.find((item) => item.orderId === order.id)?.received ??
            (orders.length === 1 ? draft.quantity : order.cases),
        ),
      ]),
    ),
  )
  const [receiver, setReceiverValue] = useState(draft.receiver)
  const [acknowledged, setAcknowledgedValue] = useState(draft.acknowledged)
  const [exception, setExceptionValue] = useState(draft.exception)
  const [remarks, setRemarksValue] = useState(draft.managerSignOff?.remarks ?? '')
  const [signature, setSignature] = useState(draft.signature)
  const [signOff, setSignOff] = useState<ManagerSignOff | undefined>(draft.managerSignOff)
  const [resetKey, setResetKey] = useState(0)
  const generation = useRef(0)
  const [errors, setErrors] = useState<string[]>([])
  const unloadedOrders = orders.map((order) => ({
    orderId: order.id,
    expected: order.cases,
    received: received[order.id]?.trim() ? Number(received[order.id]) : NaN,
  }))
  const quantity = unloadedOrders.reduce((sum, order) => sum + order.received, 0)
  function clearSignature() {
    generation.current++
    setSignature(undefined)
    setSignOff(undefined)
    setResetKey((value) => value + 1)
  }
  function updateQuantity(orderId: string, value: string) {
    clearSignature()
    setReceived((current) => ({ ...current, [orderId]: value }))
  }
  function setReceiver(value: string) {
    clearSignature()
    setReceiverValue(value)
    setAcknowledgedValue(false)
  }
  function setAcknowledged(value: boolean) {
    clearSignature()
    setAcknowledgedValue(value)
  }
  function setException(value: string) {
    clearSignature()
    setExceptionValue(value)
  }
  function setRemarks(value: string) {
    clearSignature()
    setRemarksValue(value)
  }
  async function captureSignature(strokes: SignatureStroke[], image: Blob) {
    const version = ++generation.current
    try {
      const digest = draft.photoDigest || (await photoDigest(draft.photo))
      if (version !== generation.current) return
      const details = {
        method: 'signature' as const,
        managerName: receiver.trim(),
        remarks: remarks.trim(),
        unloaded: acknowledged,
        orders: unloadedOrders,
        strokes,
        signedAt: new Date().toISOString(),
        photoDigest: digest,
      }
      setSignature(image)
      setSignOff({
        ...details,
        binding: signOffBinding({ ...draft, quantity, receiver, exception }, details),
      })
    } catch (problem) {
      if (version === generation.current)
        setErrors([
          problem instanceof Error
            ? problem.message
            : 'The signature could not be retained. Please try again.',
        ])
    }
  }

  function saveHandoff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextDraft = {
      ...draft,
      quantity,
      receiver,
      acknowledged,
      exception,
      signature,
      managerSignOff: signOff,
    }
    const problems = handoffErrors(nextDraft, expected)
    setErrors(problems)
    if (problems.length) return
    action.runAndNavigate(() => apis.delivery.saveProofDraft(nextDraft), next)
  }
  return {
    received,
    updateQuantity,
    receiver,
    setReceiver,
    acknowledged,
    setAcknowledged,
    exception,
    setException,
    remarks,
    setRemarks,
    errors,
    saveHandoff,
    busy: action.isPending,
    resetKey,
    clearSignature,
    captureSignature,
    validSignature: !!signOff && hasSignatureInk(signOff.strokes),
  }
}
