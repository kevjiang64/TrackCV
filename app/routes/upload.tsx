import { AIResponseFormat, prepareInstructions } from "constants/index";
import React, { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import FileUploader from "~/components/FileUploader";
import NavBar from "~/components/NavBar";
import { convertPdfToImage } from "~/lib/pdf2Image";
import { usePuterStore } from "~/lib/puter";
import { generateUUID } from "~/lib/utils";

const upload = () => {
  const { fs, kv, ai } = usePuterStore();
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const handleFileSelect = (file: File | null) => {
    setFile(file);
  };

  const handleAnalyze = async ({
    companyName,
    jobTitle,
    jobDescription,
    file,
  }: {
    companyName: string;
    jobTitle: string;
    jobDescription: string;
    file: File;
  }) => {
    setIsProcessing(true);
    setStatusText("Uploading your resume...");

    const uploadedFile = await fs.upload([file]);

    if (!uploadedFile) {
      setStatusText("Error: Failed to upload file.");
      return;
    }

    setStatusText("Converting your resume into image...");

    const imageFile = await convertPdfToImage(file);

    if (!imageFile.file) {
      setStatusText("Error: Failed to convert PDF to image.");
      return;
    }

    setStatusText("Uploading resume image...");
    const uploadedImage = await fs.upload([imageFile.file]);

    if (!uploadedImage) {
      setStatusText("Error: Failed to upload image.");
      return;
    }

    setStatusText("Preparing data...");

    const uuid = generateUUID();

    const data = {
      id: uuid,
      resumePath: uploadedFile.path,
      imagePath: uploadedImage.path,
      companyName,
      jobTitle,
      jobDescription,
      feedback: "",
    };

    await kv.set(`resume:${uuid}`, JSON.stringify(data));

    setStatusText("Analyzing...");

    const feedback = await ai.feedback(
      uploadedFile.path,
      prepareInstructions({ jobTitle, jobDescription, AIResponseFormat })
    );

    if (!feedback) {
      setStatusText("Error: Failed to analyze resume.");
      return;
    }

    const feedbackText =
      typeof feedback.message.content === "string"
        ? feedback.message.content
        : feedback.message.content[0].text;

    data.feedback = JSON.parse(feedbackText);

    await kv.set(`resume:${uuid}`, JSON.stringify(data));

    setStatusText("Analysis complete. Redirecting...");

    navigate(`/resume/${uuid}`);
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget.closest("form");
    if (!form) return;

    const formData = new FormData(form);

    const companyName = formData.get("company-name") as string;
    const jobTitle = formData.get("job-title") as string;
    const jobDescription = formData.get("job-description") as string;

    if (!file) return;

    handleAnalyze({ companyName, jobTitle, jobDescription, file });
  };

  return (
    <main className="bg-[url('/images/bg-main.svg')] bg-cover">
      <NavBar />
      <section className="main-section">
        <div className="page-heading py-16">
          <h1>Smart Feedback for your dream job</h1>
          {isProcessing ? (
            <>
              <h2>{statusText}</h2>
              <img src="/images/resume-scan.gif" className="w-full"></img>
            </>
          ) : (
            "Drop your resume for an ATS score and improvement tips!"
          )}
          {!isProcessing && (
            <form
              id="upload-form"
              onSubmit={handleSubmit}
              className="flex flex-col gap-4 mt-8"
            >
              <div className="form-div">
                <label htmlFor="company-name">Company Name</label>
                <input
                  type="text"
                  name="company-name"
                  placeholder="Company Name"
                  id="company-name"
                ></input>
              </div>

              <div className="form-div">
                <label htmlFor="job-title">Job Title</label>
                <input
                  type="text"
                  name="job-title"
                  placeholder="Job Title"
                  id="job-title"
                ></input>
              </div>

              <div className="form-div">
                <label htmlFor="job-description">Job Description</label>
                <textarea
                  rows={5}
                  name="job-description"
                  placeholder="Job Description"
                  id="job-description"
                ></textarea>
              </div>

              <div className="form-div">
                <label htmlFor="uploader">Upload Resume</label>
                <FileUploader onFileSelect={handleFileSelect} />
              </div>

              <button type="submit" className="primary-button">
                Submit
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
};

export default upload;
