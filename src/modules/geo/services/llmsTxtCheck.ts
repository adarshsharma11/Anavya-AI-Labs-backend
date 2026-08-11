import axios from "axios";

export interface LlmsTxtResult {
  present: boolean;
  status: number;
}

export async function checkLlmsTxt(baseUrl: string): Promise<LlmsTxtResult> {
  const llmsUrl = `${baseUrl.replace(/\/$/, "")}/llms.txt`;

  try {
    const response = await axios.get(llmsUrl, {
      timeout: 5000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      }
    });

    return {
      present: response.status === 200,
      status: response.status
    };
  } catch (error: any) {
    return {
      present: false,
      status: error.response?.status || 404
    };
  }
}
