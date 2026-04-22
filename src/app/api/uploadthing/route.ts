import { createUploadthing, createRouteHandler, type FileRouter } from "uploadthing/next"
import { UploadThingError } from "uploadthing/server"
import { auth } from "@/auth"

const f = createUploadthing()

export const ourFileRouter = {
  goalAttachment: f({
    pdf: { maxFileSize: "32MB", maxFileCount: 5 },
    video: { maxFileSize: "256MB", maxFileCount: 2 },
    image: { maxFileSize: "8MB", maxFileCount: 10 },
    audio: { maxFileSize: "64MB", maxFileCount: 5 },
    blob: { maxFileSize: "32MB", maxFileCount: 5 },
  })
    .middleware(async () => {
      const session = await auth()
      if (!session?.user?.id) throw new UploadThingError("Unauthorized")
      return { userId: session.user.id }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return {
        url: file.ufsUrl,
        key: file.key,
        name: file.name,
        size: file.size,
        userId: metadata.userId,
      }
    }),
} satisfies FileRouter

export type OurFileRouter = typeof ourFileRouter

export const { GET, POST } = createRouteHandler({ router: ourFileRouter })
