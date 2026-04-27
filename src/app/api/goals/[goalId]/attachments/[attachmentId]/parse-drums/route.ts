import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { z } from "zod"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export const maxDuration = 60

const drumNoteSchema = z.object({
  time: z.number().int().nonnegative(),
  midi: z.number().int().min(0).max(127),
  duration: z.number().int().positive(),
  velocity: z.number().int().min(1).max(127),
})

const drumScoreDataSchema = z.object({
  header: z.object({
    ppq: z.number().int().positive(),
    timeSignature: z.tuple([z.number().int().positive(), z.number().int().positive()]),
    suggestedBpm: z.number().int().positive().optional(),
    name: z.string().optional().nullable(),
  }),
  tracks: z.array(
    z.object({
      notes: z.array(drumNoteSchema),
    })
  ).min(1),
})

export type DrumScoreData = z.infer<typeof drumScoreDataSchema>

const SYSTEM_PROMPT = `You are a drum sheet music transcription engine. Your task is to analyze drum sheet music and output a machine-readable JSON representation suitable for MIDI playback.

Output ONLY valid JSON — no markdown, no explanation, no code fences.

Use this exact schema:
{
  "header": {
    "ppq": 480,
    "timeSignature": [4, 4],
    "suggestedBpm": 120,
    "name": "Song title or null"
  },
  "tracks": [
    {
      "notes": [
        { "time": 0, "midi": 36, "duration": 120, "velocity": 100 }
      ]
    }
  ]
}

Rules:
- ppq is always 480 (pulses per quarter note). All times are in ticks relative to the start.
- "time" is the absolute tick offset from the beginning of the piece.
- "duration" for percussion is always 120 (short hit). Use 60 for ghost notes.
- "velocity" range 1–127. Use 100 for normal hits, 127 for accents, 60 for ghost notes.
- Expand all repeats and repeat signs fully into individual measures.
- If the time signature changes mid-piece, continue ticking from where you left off.

Tick math examples (ppq=480):
- Quarter note = 480 ticks
- 8th note = 240 ticks
- 16th note = 120 ticks
- 32nd note = 60 ticks
- Triplet 8th = 160 ticks  (480/3)
- Triplet 16th = 80 ticks  (480/6)
- Quintuplet 16th = 96 ticks (480/5)
- Dotted 8th = 360 ticks

General MIDI drum map (use these midi values):
35 or 36 = Kick (Bass Drum)
38 = Snare (Acoustic)
37 = Rimshot / Side Stick
40 = Electric Snare
42 = Hi-Hat Closed
44 = Hi-Hat Pedal
46 = Hi-Hat Open
49 = Crash Cymbal 1
57 = Crash Cymbal 2
51 = Ride Cymbal 1
59 = Ride Cymbal 2
53 = Ride Bell
41 = Low Floor Tom
43 = High Floor Tom
45 = Low Tom
47 = Low-Mid Tom
48 = High-Mid Tom
50 = High Tom

If the document is not drum sheet music or is unreadable, output:
{ "error": "brief description of why it cannot be parsed" }
`

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ goalId: string; attachmentId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { goalId, attachmentId } = await params

  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    include: { goal: true },
  })

  if (!attachment || attachment.goal.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  if (attachment.goalId !== goalId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  if (attachment.attachmentType !== "PDF") {
    return NextResponse.json({ error: "Only PDF attachments can be parsed" }, { status: 400 })
  }

  await prisma.drumScore.upsert({
    where: { attachmentId },
    create: {
      attachmentId,
      goalId,
      userId: session.user.id,
      status: "PROCESSING",
    },
    update: { status: "PROCESSING", errorMessage: null, data: undefined },
  })

  try {
    const pdfResponse = await fetch(attachment.url)
    if (!pdfResponse.ok) throw new Error("Failed to fetch PDF")
    const pdfBuffer = await pdfResponse.arrayBuffer()
    const pdfBase64 = Buffer.from(pdfBuffer).toString("base64")

    const client = new Anthropic()
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: pdfBase64,
              },
            },
            {
              type: "text",
              text: "Parse this drum sheet music and return the JSON representation.",
            },
          ],
        },
      ],
    })

    const rawText = message.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim()

    let parsed: unknown
    try {
      parsed = JSON.parse(rawText)
    } catch {
      throw new Error("Model returned non-JSON output")
    }

    if (typeof parsed === "object" && parsed !== null && "error" in parsed) {
      await prisma.drumScore.update({
        where: { attachmentId },
        data: {
          status: "FAILED",
          errorMessage: String((parsed as { error: unknown }).error),
        },
      })
      return NextResponse.json(
        { error: (parsed as { error: unknown }).error },
        { status: 422 }
      )
    }

    const validated = drumScoreDataSchema.parse(parsed)

    const suggestedBpm = validated.header.suggestedBpm ?? null

    const drumScore = await prisma.drumScore.update({
      where: { attachmentId },
      data: {
        status: "READY",
        data: validated as object,
        suggestedBpm,
        errorMessage: null,
      },
    })

    return NextResponse.json({ drumScore })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Parsing failed"
    await prisma.drumScore.update({
      where: { attachmentId },
      data: { status: "FAILED", errorMessage: message },
    })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
