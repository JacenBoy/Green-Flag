const series = "trucks";
const raceid = "5226";

const fetch = require("node-fetch");
const blessed = require("neo-blessed");

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const screen = blessed.screen({
  autoPadding: true,
  smartCSR: true,
  dockBorders: true,
  title: "Green Flag!"
});

const scoringBox = blessed.box({
  width: "100%",
  height: "85%",
  top: "15%",
  left: "0%",
  border: {
    type: "line"
  },
  scrollable: true,
  scrollbar: true,
  keys: true,
  style: {
    scrollbar: {
      bg: "white",
      fg: "white"
    }
  }
});
screen.append(scoringBox);

const lapsBox = blessed.box({
  width: "25%",
  height: "15%",
  top: "0%",
  left: "75%",
  align: "center",
  border: {
    type: "line"
  }
});
screen.append(lapsBox);

const eventBox = blessed.box({
  width: "75%",
  height: "15%",
  top: "0%",
  left: "0%",
  align: "center",
  border: {
    type: "line"
  }
});
screen.append(eventBox);

screen.key(['escape', 'q', 'C-c'], () => {
  return process.exit(0);
});

let scoringurl;
switch (series.toLowerCase()) {
  case "trucks":
    scoringurl = `https://www.nascar.com/live/feeds/series_3/${raceid}/live_feed.json`;
    break;
  case "xfinity":
    scoringurl = `https://www.nascar.com/live/feeds/series_2/${raceid}/live_feed.json`;
    break;
  case "cup":
    scoringurl = `https://www.nascar.com/live/feeds/series_1/${raceid}/live_feed.json`;
    break;
  default:
    console.error("Invalid series provided");
    process.exit(0);
}

(async () => {
  while (true) {
    const scoring = await fetch(scoringurl).then(res => res.json());

    eventBox.setText(`${scoring.run_name}\n${scoring.track_name}`);

    lapsBox.setText(`Lap ${scoring.lap_number < scoring.laps_in_race ? scoring.lap_number + 1 : scoring.lap_number} / ${scoring.laps_in_race}\n${scoring.laps_to_go} to go`);
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

    const drivers = scoring.vehicles.sort((a,b) => (a.running_position > b.running_position) ? 1 : -1);
    for (i=0;i<drivers.length;i++) {
      let delta;
      if (drivers[i].running_position == 1) delta = "Leader";
      else if (drivers[i].status == 2) delta = "Off";
      else if (drivers[i].status == 3) delta = "Out"; 
      else if (drivers[i].delta.toString().indexOf("-") != -1) delta = `${drivers[i].delta} lap${Math.abs(drivers[i].delta) == 1 ? "" : "s"}`;
      else delta = `-${drivers[i].delta}`;
      scoringBox.setLine(i, `${drivers[i].running_position.toString().padStart(2, " ")}.\t${drivers[i].vehicle_number.toString().padStart(2, " ")}\t${drivers[i].driver.full_name.replace(" #", "").replace("(i)", "").padEnd(40, " ")}\t${delta.padEnd(10, " ")}`);
    }

    screen.render();
    await sleep(5000);
  }
})();