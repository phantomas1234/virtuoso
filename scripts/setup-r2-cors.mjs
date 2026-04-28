import { S3Client, PutBucketCorsCommand } from "@aws-sdk/client-s3"

const required = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"]
const missing = required.filter((k) => !process.env[k])
if (missing.length) {
  console.error(`Missing env vars: ${missing.join(", ")}`)
  process.exit(1)
}

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
})

await r2.send(
  new PutBucketCorsCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    CORSConfiguration: {
      CORSRules: [
        {
          AllowedOrigins: ["*"],
          AllowedMethods: ["PUT"],
          AllowedHeaders: ["Content-Type"],
          MaxAgeSeconds: 3600,
        },
      ],
    },
  })
)

console.log(`CORS configured on bucket "${process.env.R2_BUCKET_NAME}" — browsers can now upload directly.`)
