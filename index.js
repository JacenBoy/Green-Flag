// Load the external libraries we'll be using
const fetch = require("node-fetch");
const blessed = require("neo-blessed");

// Define a sleep() convenience function
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Initialize the screen object
const screen = blessed.screen({
  autoPadding: true,
  smartCSR: true,
  dockBorders: true,
  title: "Green Flag!"
});

// Add scoring box
// This contains information on drivers and their running positions
const scoringBox = blessed.box({
  width: "75%",
  height: "85%",
  top: "15%",
  left: "0%",
  border: {
    type: "line"
  },
  scrollable: true,
  scrollbar: true,
  keys: true,
  tags: true,
  style: {
    scrollbar: {
      bg: "white",
      fg: "white"
    }
  }
});
screen.append(scoringBox);

// Add laps remaining box
// Contains information about how many laps are remaining and the
// track status
const lapsBox = blessed.box({
  width: "25%",
  height: "15%",
  top: "0%",
  left: "75%",
  align: "center",
  valign: "middle",
  border: {
    type: "line"
  },
  tags: true
});
screen.append(lapsBox);

// Add event box
// Contains the name of the event and the track
const eventBox = blessed.box({
  width: "75%",
  height: "15%",
  top: "0%",
  left: "0%",
  align: "center",
  valign: "middle",
  border: {
    type: "line"
  },
  tags: true
});
screen.append(eventBox);

// Add notes box
// Contains information about notable events during the race
const notesBox = blessed.log({
  width: "25%",
  height: "85%",
  top: "15%",
  left: "75%",
  border: {
    type: "line"
  }, 
  tags: true
});
screen.append(notesBox);

// Set up keybinds to exit the program
screen.key(['escape', 'q', 'C-c'], () => {
  return process.exit(0);
});

// We wrap the main application loop in an anonymous self-executing
// async function to take advantage of async/await syntax
(async () => {
  // Grab the schedules for the three major series and see if there
  // is a race today for any of them
  const year = new Date().getFullYear()
  const schedules = {};
  schedules.trucks = await fetch(`https://www.nascar.com/cacher/${year}/3/race_list_basic.json`).then(res => res.json());
  schedules.xfinity = await fetch(`https://www.nascar.com/cacher/${year}/2/race_list_basic.json`).then(res => res.json());
  schedules.cup = await fetch(`https://www.nascar.com/cacher/${year}/1/race_list_basic.json`).then(res => res.json());
  // Combine the three shcedules into one array 
  schedules.array = [].concat(schedules.trucks, schedules.xfinity, schedules.cup);
  let seriesInfo = {};
  schedules.array.every(race => {
    const today = new Date();
    const raceDate = new Date(race.tunein_date);
    if (today.getDate() ==  raceDate.getDate() && today.getMonth() ==  raceDate.getMonth() && today.getFullYear() ==  raceDate.getFullYear()) {
      seriesInfo.found = true;
      seriesInfo.sid = race.series_id;
      seriesInfo.rid = race.race_id;
      // In case of a double-header, check to see if the race has
      // already finished, so we can load the second race if needed
      if (!race.margin_of_victory) return false;
    }
    return true
  });

  if (!seriesInfo.found) {
    // Display a message if there's no race today
    eventBox.setText("No race found for today");
    screen.render();
  } else {
    // Main application loop
    while (true) {
      // Fetch the timing and scoring data
      const scoring = await fetch(`https://www.nascar.com/live/feeds/series_${seriesInfo.sid}/${seriesInfo.rid}/live_feed.json`).then(res => res.json());
      // Fetch the lap notes or return an empty objecy if there are none
      const racenotes = await fetch(`https://www.nascar.com/cacher/${year}/${seriesInfo.sid}/${seriesInfo.rid}/lap-notes.json`).then(res => res.json()).catch(err => {return {laps: {}}});
  
      // Set the race name and the track name
      eventBox.setText(`${scoring.run_name}\n${scoring.track_name}`);
  
      // Display the current lap and how many laps are remaining
      lapsBox.setText(`Lap ${scoring.lap_number < scoring.laps_in_race ? scoring.lap_number + 1 : scoring.lap_number} / ${scoring.laps_in_race}\n${scoring.laps_to_go} to go`);
      // Also color the box based on the current track condition
      // 1 - Green; 2 - Yellow; 3 - Red
      // 4 - Checkered; 5 - White
      // 8 - Warm-up (pre-race); 9 - Not live
      switch (scoring.flag_state) {
        case 1:
          lapsBox.style.bg = "green";
          lapsBox.style.fg = "black";
          break;
        case 2:
        case 8:
          lapsBox.style.bg = "yellow";
          lapsBox.style.fg = "black";
          break;
        case 3:
          lapsBox.style.bg = "red";
          lapsBox.style.fg = "white";
          break;
        case 5:
          lapsBox.style.bg = "white";
          lapsBox.style.fg = "black";
          break;
        default:
          lapsBox.style.bg = "black";
          lapsBox.style.fg = "white";
      }
  
      // Make sure the running order is correctly sorted
      const drivers = scoring.vehicles.sort((a,b) => (a.running_position > b.running_position) ? 1 : -1);
      // Loop through the running order to display in the scoring box
      for (i=0;i<drivers.length;i++) {
        // Depending on the status of the driver, we'll display the
        // time delta
        let delta;
        // If running position is 1, driver is the leader
        if (drivers[i].running_position == 1) delta = "Leader";
        // If the "status" property is 3, driver has retired the car
        else if (drivers[i].status == 3) delta = "Out";
        // If the "status" property is 6, the driver has taken the car to the garage
        else if (drivers[i].status == 6) delta = "Off";
        // If the "delta" property starts with the "-" character, driver is lap(s) down
        else if (drivers[i].delta.toString().indexOf("-") != -1) delta = `${drivers[i].delta} lap${Math.abs(drivers[i].delta) == 1 ? "" : "s"}`;
        // Otherwise, "delta" property is just in seconds
        else delta = `-${drivers[i].delta}`;
        // Show running position, car number, driver name, and delta in a tab-spaced format
        scoringBox.setLine(i, `${drivers[i].running_position.toString().padStart(2, " ")}.\t#${drivers[i].vehicle_number.toString().padEnd(2, " ")}\t${drivers[i].driver.full_name.replace(" #", "").replace("(i)", "").padEnd(30, " ")}\t${delta.padEnd(10, " ")}`);
      }

      // Loop through the lap notes and output them to the
      // appropriate box
      var j = 0;
      notesBox.setContent("");
      for (const [lap, notes] of Object.entries(racenotes.laps)) {
        notes.forEach(note => {
          notesBox.setLine(j, `{yellow-fg}Lap ${lap}:{/} ${note.Note}\n`);
          j++;
        });
        
      }
  
      // Render all the changes we've made to the screen
      screen.render();
      // Sleep before processing the application loop again
      await sleep(5 * 1000); // 5 seconds
    }
  }
})();