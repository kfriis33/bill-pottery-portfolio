// Import images as URLs
import manyHandsImg from "url:./images/many-hands.jpg";
import fishStrainerImg from "url:./images/fish-strainer.jpg";
import threePitchersImg from "url:./images/three-pitchers.jpg";
import faceLamp1Img from "url:./images/face-lamp-1.jpeg";
import faceLamp2Img from "url:./images/face-lamp-2.jpeg";
import jadeRedNarrowImg from "url:./images/jade-red-narrow.jpeg";
import jadeRedNarrow2Img from "url:./images/jade-red-narrow-2.jpg";
import jadeRedWide1Img from "url:./images/jade-red-wide-1.jpeg";
import jadeRedWide2Img from "url:./images/jade-red-wide-2.jpeg";
import moonJar1Img from "url:./images/moon-jar-1.jpeg";
import moonJar2Img from "url:./images/moon-jar-2.jpeg";
import oceanMoonJarImg from "url:./images/ocean-moon-jar.jpeg";

// Pottery data with local images
export const potteryPieces = [
  {
    id: 1,
    title: "Untitled",
    images: [jadeRedWide1Img, jadeRedWide2Img],
    shape: "Vase",
    clay: "Red Velvet",
    seasonYear: "Winter 2024"
  },
  {
    id: 2,
    title: "Many Hands",
    image: manyHandsImg,
    shape: "Vase",
    clay: "Red Velvet",
    seasonYear: "Summer 2024"
  },
  {
    id: 3,
    title: "Fish Strainer",
    image: fishStrainerImg,
    shape: "Kitchenware",
    clay: "Porcelain",
    seasonYear: "Winter 2025"
  },
  {
    id: 4,
    title: "Three Pitchers",
    images: [threePitchersImg],
    shape: "Pitcher",
    clay: "Mixed",
    seasonYear: "Spring 2024"
  },
  {
    id: 5,
    title: "Faces",
    images: [faceLamp2Img, faceLamp1Img],
    shape: "Lamp",
    clay: "Porcelain",
    seasonYear: "Summer 2024"
  },
  {
    id: 6,
    title: "Untitled",
    images: [jadeRedNarrow2Img, jadeRedNarrowImg],
    shape: "Vase",
    clay: "Red Velvet",
    seasonYear: "Winter 2025"
  },
  {
    id: 7,
    title: "Moon Jar",
    images: [moonJar1Img, moonJar2Img],
    shape: "Moon Jar",
    clay: "Porcelain",
    seasonYear: "Summer 2025"
  },
  {
    id: 8,
    title: "Ocean Moon Jar",
    image: oceanMoonJarImg,
    shape: "Moon Jar",
    clay: "B-Mix",
    seasonYear: "Summer 2025"
  }
];

// Extract unique values for filters
export const getUniqueValues = (key) => {
  return [...new Set(potteryPieces.map(piece => piece[key]))].sort();
};
