import React, { Component } from "react";
import EventsList, { EventData } from "./EventsList";
import Button from "./Button.Forward";
import dummyResponse from "../events.json";
import { GregorianDay } from "../utils/constants";
import { scrollUp, scrollDown } from "../utils/scroll";
import * as ical from "ical";

/**
 * Props to provide to the site
 */
export interface SiteProps {
	/** Calendar to fetch events from, e.g. `calendar@camphillboys.bham.sch.uk` */
	calendarURL: string;
	/** Day of the Week A/B event that marks a week as being A/B, 0-6, where 0 is Sunday */
	weekMarkerDate: GregorianDay;
}

const baseEventImageStyle = {
	backgroundSize: "contain",
	backgroundRepeat: "no-repeat",
	backgroundPosition: "center",
	display: "flex",
	flex: 1,
	margin: "auto",
	width: "90%",
	maxHeight: "80%",
};

interface TheState {
	/** Set to true if neither Week A or B is detected */
	isNotWeekAB: boolean;
	week: "A" | "B" | "unknown";
	/** Tells page when API has ran  (i.e. page loaded) */
	apiHasRan: boolean;
	isWeekend: boolean;
	eventData: EventData;
}

/**
 * Contains the site of isitweeka.com itself.
 * They way, we can easily create variations of it for e.g. different school
 */
export default class SiteContainer extends Component<SiteProps, TheState> {

	constructor(props: SiteProps) {
		super(props);
		this.state = {
			isNotWeekAB: false,
			week: "unknown",
			apiHasRan: false,
			isWeekend: false,
			eventData: {
				events: [],
				generatedAt: "",
			},
		};
	}

	componentDidMount() {
		try {
			this.getCalendar();
			this.fetchEvents();
		} catch (err) {
			console.error("Error: " + err?.message);
		}
	}

	async fetchEvents() {
		// TODO: Add real fetch logic, likely based on an inputted URL
		this.setState({
			eventData: dummyResponse,
		});
	}

	/**
	 * Gets the monday from a week
	 * From https://stackoverflow.com/questions/4156434/javascript-get-the-first-day-of-the-week-from-current-date
	 * @deprecated Use {@link forwardOrRewindToDay} instead
	 */
	getMonday(d: Date) {
		const dhere = new Date(d);
		const day = dhere.getDay();
		// Sunday is day 0
		// Sat is Day 6
		// If Sun or Sat go to next week
		/**
		 * What this does is:
		 * - Take the current date
		 * - Subtract the day of the week, taking us to the previous Sunday
		 * - Go forward one to monday
		 * - BUT if the current date is a Saturday, add 8 instead as we want 2 days after that Saturday (the next week), not the previous Monday
		 */
		const diff = dhere.getDate() - day + (day === 6 ? 8 : 1); // adjust when day is saturday -> add 6 to bring us back to Saturday, then add 2 to go to Monday
		return new Date(dhere.setDate(diff));
	}

	/**
	 * Go back to the first of a given day during a week, or to the next of the day for forwardList
	 * Based on https://stackoverflow.com/questions/4156434/javascript-get-the-first-day-of-the-week-from-current-date
	 * @param d Date object representing the day to 'rewind'
	 * @param goTo Day number (0-6, 0 = Sunday) to go to
	 * @param forwardList List of day numbers to forward to `goTo` (instead of backwards).
	 */
	forwardOrRewindToDay(d: Date, goTo: GregorianDay, forwardList: number[]) {
		const dhere = new Date(d);
		const day = dhere.getDay();
		// Sunday is day 0
		// Sat is Day 6
		// If Sun or Sat go to next week
		/**
		 * What this does is:
		 * - Take the current date
		 * - Subtract the day of the week, taking us to the previous Sunday
		 * - Go forward by goTo days to the day we want (works as goTo is effectivly a "Sunday offset")
		 * - BUT if the current date is in the forward list, add 7 as well to go forward 1 week
		 */
		const diff = dhere.getDate() - day + goTo + (forwardList.includes(day) ? 7 : 0); // adjust when day is saturday -> add 6 to bring us back to Saturday, then add 2 to go to Monday
		return new Date(dhere.setDate(diff));
	}

	/**
	 * Loads the KECHB calendar, finds the current week, then goes to the Monday of that week and checks for a Week A or Week B event.
	 */
	async getCalendar() {
		const inputDate = new Date();
		// Used for fiddling:
		// inputDate.setDate(1);
		// inputDate.setMonth(0);
		// inputDate.setFullYear(2021);
		const weekStart = this.forwardOrRewindToDay(inputDate, this.props.weekMarkerDate, [0, 6]);
		weekStart.setUTCHours(0, 0, 0, 0); // Set to start of day
		const weekEnd = new Date(weekStart);
		weekEnd.setDate(weekEnd.getDate() + 1);
		weekEnd.setUTCHours(0, 0, 0, 0); // Set to start of day

		// Tell us if weekend!
		const dayNow = inputDate.getDay();
		if (dayNow === 6 || dayNow === 0) { // 0 is Sunday, 6 is Saturday
			this.setState({
				isWeekend: true,
			});
		}

		const startTime = weekStart.toISOString();
		const endTime = weekEnd.toISOString();

		const baseResponse = await fetch(this.props.calendarURL, {
			method: "GET",
			mode: "no-cors",
			credentials: "same-origin",
		});

		const ics = await baseResponse.text();

		// console.log(ics);

		const data = ical.parseICS(ics);

		// console.log(data);

		const map = new Map(Object.entries(data));

		map.forEach((v, key) => {
			if (v.start?.toISOString() !== startTime) {
				map.delete(key);
			}
		});

		// Filter events to those that are "Week A" or "Week B"
		let theEvent: ical.CalendarComponent | undefined;
		map.forEach((entry, key) => {
			if (entry.summary === "Week A" || entry.summary === "Week B") {
				theEvent = entry;
			} else {
				map.delete(key);
			}
		});
		if (map.size === 0 || !theEvent) {
			// Neither detected.  Probably Hols.
			this.setState({
				isNotWeekAB: true,
				week: "unknown",
				apiHasRan: true,
			});
		} else {
			// const theEvent = eventsToday[0];
			switch (theEvent.summary) {
				case "Week A":
					this.setState({
						week: "A",
						apiHasRan: true,
					});
					break;
				case "Week B":
					this.setState({
						week: "B",
						apiHasRan: true,
					});
					break;
				default:
					// NEITHER!
					// Something went wrong
					this.setState({
						isNotWeekAB: true,
						apiHasRan: true,
					});
					break;
			}
		}
	}

	/**
	 * Used to get what to display as the jumbotron, i.e. is it Week A, B or neither?
	 */
	getStatus() {
		if (this.state.isNotWeekAB || this.state.week === "unknown") {
			return (
				<>
					<h2>It is neither Week A nor B.</h2>
					<h3>This means it&#39;s probably a holiday.</h3>
					<Button style={{ marginRight: "auto" }} className="forward" onClick={scrollDown}><div>events</div></Button>
					<h5>If you believe this is in error, please email&nbsp;<a href="mailto:info@isitweeka.com">info@isitweeka.com</a></h5>
				</>
			);
		} else {
			return (
				<>
					<h2>{this.state.isWeekend ? "Next week will be" : "It is"}</h2> {/* Special case for weekend, where we show next week*/}
					<h1>Week {this.state.week}</h1>
					<h4>More coming soon...</h4>
					<Button style={{ marginRight: "auto" }} className="forward" onClick={scrollDown}>events</Button>
				</>
			);
		}
	}

	render() {
		return (
			<>
				<div className="isitweeka isitweeka-jumbotron">
					{
						this.state.apiHasRan ? this.getStatus() : (<h2>Loading...</h2>)
					}
				</div>

				<EventsList eventData={this.state.eventData} />
			</>
		);
	}
}
