// Code adapted from: https://developpaper.com/nodejs-file-upload-monitoring-upload-progress/

const inputFile = document.querySelector("#file");
const selectedCodec = document.querySelector("#codec");
const progressBar = document.querySelector("#progress");

async function upload(formData) {
  let config = {
    //Note that the contenttype should be set to multipart / form data
    headers: {
      "Content-Type": "multipart/form-data",
    },
    //Listen for the onuploadprogress event
    onUploadProgress: (e) => {
      const { loaded, total } = e;
      //Using local progress events
      if (e.lengthComputable) {
        let progress = (loaded / total) * 100;
        progressBar.setAttribute("value", progress);
      }
    },
  };
  const { status, data } = await axios.post("/upload/submit", formData, config);
  if (status === 200) {
    console.log("Upload complete.");
    window.location.href = "/upload/submitted/" + data.uuid;
  }
}

//Monitor change events
function submitUploadForm() {
  //Loading file with formdata
  const formData = new FormData();
  formData.append("file", inputFile.files[0]);
  formData.append("codec", selectedCodec.value);
  // Make progress bar visible
  progressBar.style.visibility = "visible";
  //Upload file
  upload(formData);
}
