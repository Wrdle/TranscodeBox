// Code adapted from: https://developpaper.com/nodejs-file-upload-monitoring-upload-progress/

const inputFile = document.querySelector("#file");
const selectedResolution = document.querySelector("#resolution");
const progressBar = document.querySelector("#progress");
const errorText = document.querySelector("#error");

// ============== FUNCTIONS ============== //

// Submit
function submitUploadForm() {
  //Loading file with formdata
  const formData = new FormData();
  formData.append("file", inputFile.files[0]);
  formData.append("resolution", selectedResolution.value);
  // Make progress bar visible
  progressBar.style.visibility = "visible";
  //Upload file
  upload(formData);
}

async function upload(formData) {
  axios
    .post("/upload/submit", formData, config)
    .then((response) => {
      if (response.status === 200) {
        console.log("Upload complete.");
        window.location.href = "/upload/submitted/" + response.data.uuid;
      }
    })
    .catch((error) => {
      console.log(error);
      if (error.response) {
        errorText.textContent = error.response.data.message;
      }
    });
}

// ============== AXIOS CONFIG ============== //

const config = {
  //Note that the contenttype should be set to multipart / form data
  headers: {
    "Content-Type": "multipart/form-data",
  },
  //Listen for the onuploadprogress event
  onUploadProgress: (e) => {
    const { loaded, total } = e;
    //Using local progress events
    if (e.lengthComputable) {
      const progress = (loaded / total) * 100;
      progressBar.setAttribute("value", progress);
    }
  },
};
