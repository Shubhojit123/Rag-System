import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { PineconeStore } from '@langchain/pinecone';
import dotenv from 'dotenv';
import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenAI } from "@google/genai";
import { Document } from 'langchain/document';

dotenv.config();
const History = [];
const ai = new GoogleGenAI({});

export const addDocument = async (req, res) => {
    try {

        const {context}  = req.body;
        const contextString = JSON.stringify(context);

        console.log("Context received for indexing:", contextString);
        const rawDocs = [new Document({ pageContent: contextString })];


        const textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 400,
            chunkOverlap: 100,
        });
        const chunkedDocs = await textSplitter.splitDocuments(rawDocs);
        console.log('Number of chunks:', chunkedDocs.length);

        const embeddings = new GoogleGenerativeAIEmbeddings({
            apiKey: process.env.GEMINI_API_KEY,
            model: 'text-embedding-004',
        });

        const pinecone = new Pinecone();
        const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX_NAME);

        await PineconeStore.fromDocuments(chunkedDocs, embeddings, {
            pineconeIndex,
            maxConcurrency: 5,
        });

        return res.status(200).json({ msg: "Inedxing Done" })

    } catch (error) {
        console.error('Error indexing document:', error);
    }
}

async function transformQuery(question) {

    History.push({
        role: 'user',
        parts: [{ text: question }]
    })

    const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: History,
        config: {
            systemInstruction: `You are a query rewriting expert. Based on the provided chat history, rephrase the "Follow Up user Question" into a complete, standalone question that can be understood without the chat history.
    Only output the rewritten question and nothing else,
      `,
        },
    });

    return response.text


}


export const chat = async (req, res) => {
    try {

        const { question,role, } = req.body;
        const ai = new GoogleGenAI({});

        const embeddings = new GoogleGenerativeAIEmbeddings({
            apiKey: process.env.GEMINI_API_KEY,
            model: 'text-embedding-004',
        });

        const pinecone = new Pinecone();
        const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX_NAME);

        const query = await transformQuery(question,role);
        console.log("Rephrased question: " + query);

        const queryVector = await embeddings.embedQuery(query);
        const searchResults = await pineconeIndex.query({
            topK: 5,
            vector: queryVector,
            includeMetadata: true,
        });

        const context = searchResults.matches
            .map(match => match.metadata.text)
            .join("\n\n---\n\n");


        History.push({
            role: 'user',
            parts: [{ text: question }],
        });

        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: History,
            config: {
                systemInstruction: `You have to behave like a Data Structure and Algorithm Expert.
                    You will be given a context of relevant information and a user question.
                    Your task is to answer the user's question based ONLY on the provided context.
                    If the answer is not in the context, you must say "I could not find the answer in the provided document."
                    Keep your answers clear, concise, and educational context: ${context} `
            },
        });
        const output = await response.text();
        if (output !== "I could not find the answer in the provided document") {
            History.push({
                role: 'model',
                parts: [{ text: response.text }],
            });
        }


        console.log("\n", "Response" + response.text.length + "\n");
        console.log("Context" + context + "\n");
        console.log("history " + History.length);
        if(History.length>5){
            History.shift();
            History.shift();
            console.log("History Length Exceeded " + History.length)
        }
        return res.status(200).json({ answer: response.text });
    } catch (error) {
        console.log(error)
    }
}
