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
import kerkumblyPitcher1Img from "url:./images/kerkumbly-pitcher-1.jpeg";
import kerkumblyPitcher2Img from "url:./images/kerkumbly-pitcher-2.jpeg";
import layeredVase1Img from "url:./images/first-layered-vase-1.jpeg";
import mintyVaseImg from "url:./images/minty-vase.jpeg";
import smallBowlSet1Img from "url:./images/small-bowl-set-1.jpeg";
import smallBowlSet2Img from "url:./images/small-bowl-set-2.jpeg";

// Pottery data with local images
export const potteryPieces = [
  {
    id: 1,
    title: "Jade Vase #1",
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
    seasonYear: "Spring 2023"
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
    title: "Jade Vase #2",
    images: [jadeRedNarrow2Img, jadeRedNarrowImg],
    shape: "Vase",
    clay: "Red Velvet",
    seasonYear: "Spring 2025"
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
  },
  {
    id: 9,
    title: "Kerkumbly Pitcher",
    images: [kerkumblyPitcher1Img, kerkumblyPitcher2Img],
    shape: "Pitcher",
    clay: "B-Mix",
    seasonYear: "Spring 2025"
  },
  {
    id: 10,
    title: "Layered Vase #1",
    image: layeredVase1Img,
    shape: "Vase",
    clay: "Porcelain",
    seasonYear: "Winter 2025"
  },
  {
    id: 11,
    title: "Minty Vase",
    image: mintyVaseImg,
    shape: "Vase",
    clay: "Porcelain",
    seasonYear: "Spring 2025"
  },
  {
    id: 12,
    title: "Small Bowl Set",
    images: [smallBowlSet1Img, smallBowlSet2Img],
    shape: "Bowl",
    clay: "B3",
    seasonYear: "Summer 2024"
  }
];

// Extract unique values for filters
export const getUniqueValues = (key) => {
  return [...new Set(potteryPieces.map(piece => piece[key]))].sort();
};
