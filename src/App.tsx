import React, { useState, useCallback } from 'react';
import { Upload, FileType, ArrowRight, Download, Trash2, AlertCircle, FileDown, Moon, Sun, Menu, X, Settings, Mail } from 'lucide-react';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, SectionType } from 'docx';
import { saveAs } from 'file-saver';

type ConversionType = 'pdf-to-docx' | 'docx-to-pdf' | 'jpg-to-png' | 'png-to-jpg';
type Theme = 'dark' | 'light';

type FileWithPreview = {
  file: File;
  previewUrl: string;
  convertedUrl: string | null;
  error: string | null;
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ConversionType>('pdf-to-docx');
  const [currentFile, setCurrentFile] = useState<FileWithPreview | null>(null);
  const [converting, setConverting] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [theme, setTheme] = useState<Theme>('dark');
  const [isNavOpen, setIsNavOpen] = useState<boolean>(false);

  const getAcceptedFiles = (): string => {
    switch (activeTab) {
      case 'pdf-to-docx':
        return '.pdf';
      case 'docx-to-pdf':
        return '.docx';
      case 'jpg-to-png':
        return '.jpg,.jpeg';
      case 'png-to-jpg':
        return '.png';
      default:
        return '';
    }
  };

  const getTargetFormat = (): string => {
    switch (activeTab) {
      case 'pdf-to-docx':
        return 'docx';
      case 'docx-to-pdf':
        return 'pdf';
      case 'jpg-to-png':
        return 'png';
      case 'png-to-jpg':
        return 'jpg';
      default:
        return '';
    }
  };

  const getMimeType = (format: string): string => {
    switch (format.toLowerCase()) {
      case 'pdf':
        return 'application/pdf';
      case 'docx':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case 'png':
        return 'image/png';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      default:
        return 'application/octet-stream';
    }
  };

  const processFile = (file: File): void => {
    let previewUrl = '';

    if (file.type.startsWith('image/')) {
      previewUrl = URL.createObjectURL(file);
    } else if (file.type === 'application/pdf') {
      previewUrl = '/pdf-preview.png';
    } else {
      previewUrl = '/document-preview.png';
    }

    setCurrentFile({
      file,
      previewUrl,
      convertedUrl: null,
      error: null
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>): void => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      const file = files[0];
      const acceptedTypes = getAcceptedFiles().split(',');
      const fileExtension = `.${file.name.split('.').pop()?.toLowerCase()}`;
      
      if (acceptedTypes.includes(fileExtension)) {
        processFile(file);
      } else {
        setCurrentFile({
          file,
          previewUrl: '',
          convertedUrl: null,
          error: `Invalid file type. Please upload ${acceptedTypes.join(' or ')} files.`
        });
      }
    }
  }, [getAcceptedFiles]);

  const convertImage = async (file: File, targetFormat: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(
          blob => {
            if (blob) {
              const url = URL.createObjectURL(blob);
              resolve(url);
            } else {
              reject(new Error('Failed to convert image'));
            }
          },
          targetFormat === 'jpg' ? 'image/jpeg' : 'image/png',
          0.95
        );
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  };

  const convertPDFToDocx = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const pages = pdfDoc.getPages();
    
    let fullText = '';
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      fullText += `Page ${i + 1}\n\n`;
      fullText += `[Content of page ${i + 1}]\n\n`;
    }

    const doc = new Document({
      sections: [{
        properties: {
          type: SectionType.CONTINUOUS,
        },
        children: [
          new Paragraph({
            text: file.name.split('.')[0],
            heading: HeadingLevel.HEADING_1,
          }),
          ...fullText.split('\n').map(text => 
            new Paragraph({
              children: [
                new TextRun({
                  text,
                  size: 24,
                }),
              ],
            })
          ),
        ],
      }],
    });

    const blob = await Packer.toBlob(doc);
    return URL.createObjectURL(blob);
  };
  
  
  const convertDocxToPDF = async (file: File): Promise<string> => {
    const text = await file.text();
    
    const pdfDoc = await PDFDocument.create();
    const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    
    const margin = 50;
    let y = height - margin;
    const lineHeight = 20;
    const maxWidth = width - (margin * 2);
    
    const title = file.name.split('.')[0];
    page.drawText(title, {
      x: margin,
      y,
      size: 16,
      font: timesRomanFont,
      color: rgb(0, 0, 0),
    });
    y -= lineHeight * 2;

    const lines = text.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      let currentLine = '';
      const words = line.split(' ');
      
      for (const word of words) {
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        const textWidth = timesRomanFont.widthOfTextAtSize(testLine, 12);
        
        if (textWidth > maxWidth) {
          if (y < margin) {
            const newPage = pdfDoc.addPage();
            y = height - margin;
          }
          
          page.drawText(currentLine, {
            x: margin,
            y,
            size: 12,
            font: timesRomanFont,
            color: rgb(0, 0, 0),
          });
          y -= lineHeight;
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      
      if (currentLine) {
        if (y < margin) {
          const newPage = pdfDoc.addPage();
          y = height - margin;
        }
        
        page.drawText(currentLine, {
          x: margin,
          y,
          size: 12,
          font: timesRomanFont,
          color: rgb(0, 0, 0),
        });
        y -= lineHeight;
      }
      
      y -= lineHeight / 2;
    }

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    return URL.createObjectURL(blob);
  };

  const handleConvert = async (): Promise<void> => {
    if (!currentFile) return;

    setConverting(true);
    try {
        let convertedUrl: string;

        if (activeTab === "jpg-to-png" || activeTab === "png-to-jpg") {
            // ✅ Perform image conversion client-side (without API call)
            convertedUrl = await convertImage(currentFile.file, getTargetFormat());
        } else {
            // ✅ Keep PDF/DOCX conversion as it is
            const formData = new FormData();
            formData.append("file", currentFile.file);
            formData.append("type", activeTab); // Conversion type: pdf-to-docx or docx-to-pdf

            const response = await fetch("http://127.0.0.1:5000/convert", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                throw new Error("Conversion failed");
            }

            // Generate blob URL for PDF preview
            const blob = await response.blob();
            convertedUrl = window.URL.createObjectURL(blob);
        }

        // ✅ Update the state with the converted file
        setCurrentFile((prev) =>
            prev
                ? {
                      ...prev,
                      convertedUrl,
                      previewUrl: activeTab.includes("jpg") || activeTab.includes("png") ? convertedUrl : prev.previewUrl,
                      error: null,
                  }
                : null
        );
    } catch (error) {
        setCurrentFile((prev) =>
            prev
                ? {
                      ...prev,
                      error: error instanceof Error ? error.message : "Unknown error occurred",
                  }
                : null
        );
    } finally {
        setConverting(false);
    }
};



  const handleDownload = (): void => {
    if (currentFile?.convertedUrl) {
      const targetFormat = getTargetFormat();
      const fileName = `${currentFile.file.name.split('.')[0]}.${targetFormat}`;
      const mimeType = getMimeType(targetFormat);

      fetch(currentFile.convertedUrl)
        .then(res => res.blob())
        .then(blob => {
          const file = new Blob([blob], { type: mimeType });
          saveAs(file, fileName);
        });
    }
  };

  const clearFile = (): void => {
    if (currentFile) {
      URL.revokeObjectURL(currentFile.previewUrl);
      if (currentFile.convertedUrl) {
        URL.revokeObjectURL(currentFile.convertedUrl);
      }
    }
    setCurrentFile(null);
  };

  const handleTabChange = (tab: ConversionType): void => {
    setActiveTab(tab);
    setIsNavOpen(false);
  };

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-gray-900' : 'bg-gradient-to-br from-blue-50 to-indigo-50'}`}>
      {/* Navigation */}
      <nav className={`fixed w-full z-50 ${theme === 'dark' ? 'bg-gray-800 border-b border-gray-700' : 'bg-white shadow-md'}`}>
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setIsNavOpen(!isNavOpen)}
                className="md:hidden p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700"
                aria-label="Toggle menu"
              >
                {isNavOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
              <Settings className="h-6 w-6 text-blue-400" />
              <h1 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                File Converter
              </h1>
            </div>
            <div className="hidden md:flex space-x-4">
              {['pdf-to-docx', 'docx-to-pdf', 'jpg-to-png', 'png-to-jpg'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => handleTabChange(tab as ConversionType)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === tab
                      ? 'bg-blue-600 text-white'
                      : theme === 'dark'
                      ? 'text-gray-300 hover:bg-gray-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {tab.split('-').map(word => word.toUpperCase()).join(' ')}
                </button>
              ))}
            </div>
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className={`p-2 rounded-lg ${
                theme === 'dark'
                  ? 'text-gray-300 hover:bg-gray-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Navigation Overlay */}
      {isNavOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setIsNavOpen(false)}
        />
      )}

      {/* Mobile Navigation Sidebar */}
      <div
        className={`fixed top-16 left-0 w-64 h-full ${
          theme === 'dark' ? 'bg-gray-800 border-r border-gray-700' : 'bg-white shadow-lg'
        } transform transition-transform duration-300 ease-in-out z-40 md:hidden ${
          isNavOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col p-4 space-y-2">
          {['pdf-to-docx', 'docx-to-pdf', 'jpg-to-png', 'png-to-jpg'].map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab as ConversionType)}
              className={`px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-blue-600 text-white'
                  : theme === 'dark'
                  ? 'text-gray-300 hover:bg-gray-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {tab.split('-').map(word => word.toUpperCase()).join('  ')}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 pt-24">
        <div className="max-w-4xl mx-auto">
          {/* Upload Section */}
          <div className={`rounded-xl shadow-lg p-8 mb-8 ${
            theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white'
          }`}>
            <div
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`
                border-2 border-dashed rounded-lg p-8 text-center transition-colors
                ${isDragging
                  ? 'border-blue-500 bg-blue-500/10'
                  : theme === 'dark'
                  ? 'border-gray-600 hover:border-blue-400'
                  : 'border-gray-300 hover:border-blue-400'}
              `}
            >
              <input
                type="file"
                id="file-upload"
                className="hidden"
                onChange={handleFileUpload}
                accept={getAcceptedFiles()}
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center"
              >
                <Upload className={`h-12 w-12 mb-4 ${
                  isDragging ? 'text-blue-500' : theme === 'dark' ? 'text-gray-400' : 'text-gray-400'
                }`} />
                <span className={`text-lg font-medium ${
                  theme === 'dark' ? 'text-gray-200' : 'text-gray-700'
                }`}>
                  {isDragging ? 'Drop your file here' : 'Drop files here or click to upload'}
                </span>
                <span className={`text-sm mt-2 ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  Supported format: {getAcceptedFiles().replace('.', '').toUpperCase()}
                </span>
              </label>
            </div>
          </div>

          {/* Preview Section */}
{currentFile && (
  <div
    className={`rounded-xl shadow-lg p-8 mb-8 ${
      theme === "dark" ? "bg-gray-800 border border-gray-700" : "bg-white"
    }`}
  >
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {/* Original File */}
      <div>
        <h3
          className={`text-lg font-semibold mb-4 ${
            theme === "dark" ? "text-gray-200" : "text-gray-900"
          }`}
        >
          Original File
        </h3>
        <div
          className={`rounded-lg p-4 flex flex-col items-center ${
            theme === "dark" ? "bg-gray-700/50" : "bg-gray-50"
          }`}
        >
          {currentFile.file.type.startsWith("image/") ? (
            <img
              src={currentFile.previewUrl}
              alt="Original"
              className="max-w-full h-auto rounded"
            />
          ) : (
            <FileType className="h-16 w-16 text-blue-500" />
          )}
          <p
            className={`mt-2 text-sm ${
              theme === "dark" ? "text-gray-300" : "text-gray-600"
            }`}
          >
            {currentFile.file.name}
          </p>
        </div>
      </div>

      {/* Converted File */}
<div>
  <h3 className={`text-lg font-semibold mb-4 ${theme === "dark" ? "text-gray-200" : "text-gray-900"}`}>
    Converted File
  </h3>
  <div className={`rounded-lg p-4 flex flex-col items-center ${theme === "dark" ? "bg-gray-700/50" : "bg-gray-50"}`}>
    {currentFile?.convertedUrl ? (
      <>
        <FileType className="h-16 w-16 text-blue-500" />

        <p className={`mt-2 text-sm ${theme === "dark" ? "text-gray-300" : "text-gray-600"}`}>
          {currentFile.file.name.split(".")[0]}-converted.{getTargetFormat()}
        </p>
      </>
    ) : (
      <div className={`text-center ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
        {currentFile.error ? (
          <div className="text-red-500 flex items-center">
            <AlertCircle className="h-6 w-6 mr-2" />
            {currentFile.error}
          </div>
        ) : (
          <p>Click convert to see the result</p>
        )}
      </div>
    )}
  </div>
</div>




    </div>

    {/* Actions */}
    <div className="mt-6 flex flex-wrap justify-center gap-4">
      {/* Convert Button */}
      <button
    onClick={handleConvert}
    disabled={converting}
    className={`flex items-center px-6 py-3 rounded-lg text-white font-medium transition-colors ${
        converting
            ? "bg-gray-400 cursor-not-allowed"
            : "bg-blue-600 hover:bg-blue-700"
    }`}
>
    {converting ? "Converting..." : "Convert"}
</button>


      {/* Download Button */}
      {currentFile.convertedUrl && (
        <a
          href={currentFile.convertedUrl}
          download={`${currentFile.file.name
            .split(".")[0]
            .toLowerCase()}-converted.${getTargetFormat()}`}
          className="flex items-center px-6 py-3 rounded-lg text-white font-medium bg-green-600 hover:bg-green-700 transition-colors"
        >
          Download
          <FileDown className="ml-2 h-5 w-5" />
        </a>
      )}

      {/* Clear Button */}
      <button
        onClick={clearFile}
        className={`flex items-center px-6 py-3 rounded-lg font-medium transition-colors ${
          theme === "dark"
            ? "text-gray-200 bg-gray-700 hover:bg-gray-600"
            : "text-gray-700 bg-gray-100 hover:bg-gray-200"
        }`}
      >
        Clear
        <Trash2 className="ml-2 h-5 w-5" />
      </button>
    </div>
  </div>
)}

        </div>
      </div>

      {/* Credentials Footer */}
      <div className="fixed bottom-4 right-4 flex items-center space-x-4">
        <div className={`flex flex-col items-end ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
          <span className="text-sm font-medium">Aland Fryad</span>
          <a
            href="mailto:alandf80@yahoo.com"
            className="flex items-center text-sm hover:underline"
          >
            <Mail className="h-4 w-4 mr-1" />
            alandf80@yahoo.com
          </a>
        </div>
        <div className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
          © 2025 File Converter
        </div>
      </div>
    </div>
  );
};

export default App;