import UploadForm from '@/components/UploadForm'

export const metadata = { title: 'Upload', robots: { index: false } }

export default function UploadPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-black">Upload</h1>
      <UploadForm />
    </div>
  )
}
