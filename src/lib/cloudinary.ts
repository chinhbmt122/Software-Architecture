import { v2 as cloudinary } from "cloudinary"

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export { cloudinary }

export async function uploadCoverImage(file: string, novelId: string) {
  const result = await cloudinary.uploader.upload(file, {
    folder: "novels/covers",
    public_id: novelId,
    overwrite: true,
    transformation: [{ width: 400, height: 600, crop: "fill", quality: "auto" }],
  })
  return result.secure_url
}

export async function deleteCoverImage(novelId: string) {
  await cloudinary.uploader.destroy(`novels/covers/${novelId}`)
}
