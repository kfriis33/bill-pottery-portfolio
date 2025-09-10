# Pottery Portfolio

A beautiful, minimal pottery portfolio website built with React.js. This single-page application showcases pottery pieces with filtering and sorting capabilities based on type, clay, and season/year metadata.

## Features

- 🏺 **Beautiful Gallery**: Clean, artsy grid layout for pottery pieces
- 🔍 **Smart Filtering**: Filter by pottery type, clay type, and season/year
- 📊 **Sorting Options**: Sort by title, type, clay, or season/year
- 📱 **Responsive Design**: Looks great on all devices
- 🎨 **Elegant Styling**: Simple, cool, artsy, fresh, and classy design

## Prerequisites

Before running this project, make sure you have Node.js installed on your system:

1. **Install Node.js**: Visit [nodejs.org](https://nodejs.org/) and download the latest LTS version
2. **Verify installation**: Open terminal and run:
   ```bash
   node --version
   npm --version
   ```

## Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the development server**:
   ```bash
   npm run dev
   ```

3. **Open your browser** and navigate to `http://localhost:1234`

## Project Structure

```
pottery-portfolio/
├── src/
│   ├── components/
│   │   ├── PotteryCard.js       # Individual pottery piece card
│   │   └── FilterControls.js    # Filter and sort controls
│   ├── data/
│   │   └── potteryData.js       # Pottery data with local image references
│   ├── images/                  # Local pottery images directory
│   │   ├── rustic-bowl.jpg      # Replace with your own images
│   │   ├── elegant-vase.jpg     # (currently placeholder files)
│   │   └── ...                  # Other pottery images
│   ├── styles/
│   │   └── App.css             # Main stylesheet
│   ├── App.js                  # Main application component
│   └── index.js                # Application entry point
├── index.html                  # HTML template
├── package.json               # Project configuration
└── README.md                  # This file
```

## Customization

### Adding Your Own Pottery Images

The project is now configured to use local images instead of external URLs:

1. **Add your images**: Place your JPEG files in the `src/images/` directory
2. **Update image references**: Edit the image paths in `src/data/potteryData.js` to match your new files
3. **Naming convention**: Use descriptive names like `rustic-bowl.jpg`, `elegant-vase.jpg`, etc.
4. **Update metadata**: Modify the title, type, clay, and seasonYear for each piece

**Current image files to replace:**
- `src/images/rustic-bowl.jpg`
- `src/images/elegant-vase.jpg`
- `src/images/coffee-mug-set.jpg`
- `src/images/decorative-plate.jpg`
- `src/images/garden-planter.jpg`
- `src/images/tea-set.jpg`
- `src/images/ceramic-sculpture.jpg`
- `src/images/serving-bowl.jpg`
- `src/images/modern-vase.jpg`

**Example**: To add a new piece, copy your image to `src/images/new-piece.jpg` and add an entry in `potteryData.js`:
```javascript
{
  id: 10,
  title: "My New Pottery",
  image: require("../images/new-piece.jpg"),
  type: "Bowl",
  clay: "Stoneware",
  seasonYear: "Spring 2024"
}
```

### Styling

The website uses a warm, earthy color palette with smooth animations. You can customize:
- Colors in `src/styles/App.css`
- Typography and spacing
- Grid layout and card styling

### Data Structure

Each pottery piece should have this structure:
```javascript
{
  id: unique_number,
  title: "Piece Name",
  image: "image_url_or_path",
  type: "Bowl|Vase|Mug|Plate|etc",
  clay: "Stoneware|Porcelain|Earthenware|etc",
  seasonYear: "Season YYYY"
}
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start development server (alias for dev)

## Technologies Used

- **React 18** - Modern React with hooks
- **Parcel** - Zero-configuration build tool
- **CSS3** - Modern styling with gradients and animations
- **Local Images** - Your own pottery images stored locally

## Browser Support

This project works in all modern browsers that support:
- CSS Grid and Flexbox
- ES6+ JavaScript features
- CSS custom properties (variables)

## License

MIT License - feel free to use this for your own pottery portfolio!
