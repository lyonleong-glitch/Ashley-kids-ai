
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "Ashley is not configured yet. Please try again later."
    });
  }

  const { message, age, language } = req.body || {};

  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Please enter a message." });
  }

  if (message.length > 1000) {
    return res.status(400).json({
      error: "Please keep your message under 1000 characters."
    });
  }

  const childAge = Number(age) === 6 ? 6 : 4;
  const safeLanguage = ["English", "Bahasa Melayu", "Chinese"]
    .includes(language) ? language : "English";

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: `You are Ashley, a warm, playful and safe AI companion for children aged ${childAge}. Reply in ${safeLanguage}. Use simple, age-appropriate language and short answers. Encourage curiosity, learning and kindness. Never ask for a child's full name, address, school, phone number, passwords or private photos. Never encourage secrecy from parents. For dangerous situations, tell the child to get help from a trusted adult. For medical, emergency or other serious problems, encourage help from a trusted adult. Do not provide sexual, violent, hateful or dangerous instructions. Be a friendly playmate, not a strict teacher.`
            }]
          },
          contents: [{
            role: "user",
            parts: [{ text: message.trim() }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 250
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini request failed:", response.status);
      return res.status(502).json({
        error: "Ashley couldn't answer just now. Please try again."
      });
    }

    const reply = data.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("")
      .trim();

    if (!reply) {
      return res.status(502).json({
        error: "Let's try that question again!"
      });
    }

    return res.status(200).json({ reply });
  } catch (error) {
    console.error("Ashley API error:", error.message);
    return res.status(500).json({
      error: "Something went wrong. Please try again."
    });
  }
}
